import math
from datetime import date, timedelta
from unittest.mock import MagicMock, Mock, patch

import shapely
from django.test import SimpleTestCase
from shapely.geometry import shape

from .view_modules.data_processing import validate_analysis_request
from .view_modules.earth_engine import analysis_scale
from .view_modules.ndvi_analysis import process_landsat_ndvi_analysis
from .view_modules.request_handlers import MAX_AOI_VERTICES, parse_aoi_data, simplify_aoi


def circle_aoi(vertices):
    ring = [
        [2 * math.cos(2 * math.pi * i / vertices), 2 * math.sin(2 * math.pi * i / vertices)]
        for i in range(vertices)
    ]
    ring.append(ring[0])
    geometry = {"type": "Polygon", "coordinates": [ring]}
    return {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": geometry, "properties": {}}]}


class SimplifyAoiTest(SimpleTestCase):
    def test_detailed_boundary_is_reduced_and_keeps_its_shape(self):
        aoi = circle_aoi(50000)
        original = shape(aoi["features"][0]["geometry"])
        simplified = shape(simplify_aoi(aoi)["features"][0]["geometry"])
        self.assertLessEqual(shapely.get_num_coordinates(simplified), MAX_AOI_VERTICES)
        self.assertAlmostEqual(simplified.area / original.area, 1, places=2)

    def test_simple_area_is_unchanged(self):
        aoi = circle_aoi(100)
        expected = shape(aoi["features"][0]["geometry"])
        self.assertTrue(shape(simplify_aoi(aoi)["features"][0]["geometry"]).equals(expected))


class ParseAoiTest(SimpleTestCase):
    def parse(self, aoi):
        with patch("apps.analysis.view_modules.request_handlers.geojson_to_ee_geometry") as to_ee:
            with patch(
                "apps.analysis.view_modules.request_handlers.validate_coordinates", return_value=(True, None)
            ):
                _, error = parse_aoi_data(aoi)
        return to_ee, error

    def test_detailed_wkt_boundary_is_reduced(self):
        wkt = shape(circle_aoi(50000)["features"][0]["geometry"]).wkt
        to_ee, error = self.parse(wkt)
        self.assertIsNone(error)
        simplified = shape(to_ee.call_args.args[0]["features"][0]["geometry"])
        self.assertLessEqual(shapely.get_num_coordinates(simplified), MAX_AOI_VERTICES)

    def test_invalid_wkt_is_reported(self):
        _, error = self.parse("POLYGON((not coordinates))")
        self.assertIn("Invalid AOI format", error)


class AnalysisScaleTest(SimpleTestCase):
    def geometry(self, km2):
        geometry = Mock()
        geometry.area.return_value.getInfo.return_value = km2 * 1e6
        return geometry

    def test_small_area_keeps_native_resolution(self):
        self.assertEqual(analysis_scale(self.geometry(50), 30), (30, 1))

    def test_large_area_is_sampled_more_coarsely(self):
        self.assertEqual(analysis_scale(self.geometry(240000), 30), (155, 4))


class LandsatTimeSeriesFailureTest(SimpleTestCase):
    @patch("apps.analysis.view_modules.ndvi_analysis.analysis_scale", return_value=(30, 1))
    @patch("apps.analysis.view_modules.earth_engine.calculate_ndvi_landsat")
    @patch("apps.analysis.view_modules.ndvi_analysis.series_images")
    @patch("apps.analysis.view_modules.ndvi_analysis.get_landsat_collection")
    def test_failure_is_reported_instead_of_returning_invented_values(self, _collection, series, ndvi, _scale):
        ndvi.return_value.select.return_value.reduceRegion.return_value.getInfo.return_value = {"NDVI_count": 1}
        series.return_value.map.return_value.getInfo.side_effect = RuntimeError("Read timed out")
        with self.assertRaisesMessage(RuntimeError, "Read timed out"):
            process_landsat_ndvi_analysis(MagicMock(), "2020-01-01", "2020-12-31")


class AnalysisDatesTest(SimpleTestCase):
    def validate(self, start, end, satellite="landsat"):
        return validate_analysis_request({
            "aoi_data": circle_aoi(4), "analysis_type": "ndvi", "satellite": satellite,
            "start_date": str(start), "end_date": str(end),
        })

    def test_range_can_end_today(self):
        self.assertEqual(self.validate("2026-01-01", date.today()), (True, "Valid request"))

    def test_end_date_cannot_be_in_the_future(self):
        valid, message = self.validate("2026-01-01", date.today() + timedelta(days=2))
        self.assertFalse(valid)
        self.assertEqual(message, "End date can't be later than today.")

    def test_dates_before_a_satellite_existed_name_it(self):
        valid, message = self.validate("2010-01-01", "2020-01-01", "sentinel2")
        self.assertFalse(valid)
        self.assertEqual(message, "Sentinel-2 images start on 4 July 2015. Choose a later start date.")
        self.assertTrue(self.validate("2010-01-01", "2020-01-01")[0])

    def test_unreadable_date_gets_a_clear_message(self):
        self.assertEqual(self.validate("not-a-date", "2024-01-01")[1], "Enter dates as YYYY-MM-DD, for example 2024-01-31.")
