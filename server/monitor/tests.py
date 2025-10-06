from django.test import TestCase, Client


class MonitorTestCase(TestCase):

    def test_product_monitors(self):
        response = self.client.get('/api/product_monitors')
        self.assertEqual(response.status_code, 200)

    def test_process_monitors(self):
        response = self.client.get('/api/process_monitors')
        self.assertEqual(response.status_code, 200)

    def test_project_resources(self):
        response = self.client.get('/api/project_resources')
        self.assertEqual(response.status_code, 200)

    def test_project_page_views(self):
        response = self.client.get('/api/project_page_views')
        self.assertEqual(response.status_code, 200)
