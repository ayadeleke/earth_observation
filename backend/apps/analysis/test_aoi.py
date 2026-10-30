import math
from unittest.mock import Mock

import shapely
from django.test import SimpleTestCase
from shapely.geometry import shape

from .view_modules.earth_engine import analysis_scale
from .view_modules.request_handlers import MAX_AOI_VERTICES, simplify_aoi


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


class AnalysisScaleTest(SimpleTestCase):
    def geometry(self, km2):
        geometry = Mock()
        geometry.area.return_value.getInfo.return_value = km2 * 1e6
        return geometry

    def test_small_area_keeps_native_resolution(self):
        self.assertEqual(analysis_scale(self.geometry(50), 30), 30)

    def test_large_area_is_sampled_more_coarsely(self):
        self.assertEqual(analysis_scale(self.geometry(240000), 30), 98)
