from unittest.mock import MagicMock, patch

from django.test import SimpleTestCase

from .view_modules import sar_analysis

MODULE = "apps.analysis.view_modules.sar_analysis"


def sentinel1_images(count=5, values=None):
    collection = MagicMock()
    collection.filterBounds.return_value = collection
    collection.filterDate.return_value = collection
    collection.filter.return_value = collection
    collection.size.return_value.getInfo.return_value = count
    stats = {"VV": -10.0, "VH": -17.0} if values is None else values
    collection.mean.return_value.select.return_value.reduceRegion.return_value.getInfo.return_value = stats
    return collection


def area():
    geometry = MagicMock()
    geometry.centroid.return_value.coordinates.return_value.getInfo.return_value = [-1.6, 6.7]
    geometry.area.return_value.divide.return_value.getInfo.return_value = 100
    return geometry


class AnnualAggregationTest(SimpleTestCase):
    def aggregate(self, collection):
        with patch(f"{MODULE}.ee.ImageCollection", return_value=collection):
            return sar_analysis.process_sar_with_temporal_aggregation(
                area(), "2023-01-01", "2023-10-31", "BOTH", 30, 30, 1e8
            )

    def test_returns_real_values(self):
        result = self.aggregate(sentinel1_images())
        self.assertTrue(result["success"])
        self.assertEqual(result["data"][0]["backscatter_vv"], -10.0)
        self.assertEqual(result["statistics"]["mean_vv"], -10.0)

    def test_rows_are_dated_inside_the_requested_range(self):
        with patch(f"{MODULE}.ee.ImageCollection", return_value=sentinel1_images()):
            result = sar_analysis.process_sar_with_temporal_aggregation(
                area(), "2026-08-01", "2026-10-31", "BOTH", 30, 30, 1e8
            )
        self.assertEqual(result["data"][0]["date"], "2026-09-15")

    def test_no_data_is_reported_instead_of_placeholder_statistics(self):
        result = self.aggregate(sentinel1_images(values={"VV": None, "VH": None}))
        self.assertFalse(result["success"])
        self.assertNotIn("statistics", result)


class ChunkedAggregationTest(SimpleTestCase):
    def chunk(self, start, end):
        with patch(f"{MODULE}.ee.ImageCollection", return_value=sentinel1_images()):
            return sar_analysis.process_sar_with_chunked_temporal_aggregation(area(), start, end, "BOTH", 4.5)

    def test_range_starting_mid_year_has_one_row_per_year(self):
        result = self.chunk("2020-06-01", "2024-03-01")
        self.assertEqual([row["date"][:4] for row in result["data"]], ["2020", "2021", "2022", "2023", "2024"])

    def test_range_can_start_on_29_february(self):
        self.assertTrue(self.chunk("2020-02-29", "2024-03-01")["success"])


class SarRoutingTest(SimpleTestCase):
    @patch(f"{MODULE}.process_sar_with_temporal_aggregation", return_value={"success": True})
    @patch(f"{MODULE}.get_sentinel1_collection")
    def test_selected_polarization_reaches_large_collections(self, collection, aggregate):
        collection.return_value.size.return_value.getInfo.return_value = 30
        sar_analysis.process_sar_analysis.__wrapped__(area(), "2023-01-01", "2023-10-31", polarization="VH")
        self.assertEqual(aggregate.call_args.args[-1], "VH")

    @patch(f"{MODULE}.get_sentinel1_collection")
    def test_no_images_is_reported(self, collection):
        collection.return_value.size.return_value.getInfo.return_value = 0
        result = sar_analysis.process_sar_analysis.__wrapped__(area(), "2023-01-01", "2023-10-31")
        self.assertEqual(result["error"], "No Sentinel-1 data available")


class SampledImagesTest(SimpleTestCase):
    @patch(f"{MODULE}.ee.Image")
    @patch(f"{MODULE}.get_sentinel1_collection")
    def test_images_are_read_by_their_earth_engine_id(self, collection, image):
        image_id = "COPERNICUS/S1_GRD/S1D_IW_GRDH_1SDV_20260901"
        collection.return_value.size.return_value.getInfo.return_value = 1
        collection.return_value.toList.return_value.get.return_value.getInfo.return_value = {
            "id": image_id,
            "properties": {"system:time_start": 1788000000000},
        }
        image.return_value.select.return_value.reduceRegion.return_value.getInfo.return_value = {"VV": -6.0, "VH": -14.0}

        result = sar_analysis.process_sar_analysis.__wrapped__(area(), "2026-08-01", "2026-10-31")

        image.assert_called_with(image_id)
        self.assertEqual(result["data"][0]["backscatter_vv"], -6.0)
