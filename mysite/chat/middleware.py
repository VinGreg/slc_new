from django.utils.deprecation import MiddlewareMixin

class DebugUserMiddleware(MiddlewareMixin):
    def process_request(self, request):
        print(f"Middleware: User - {request.user}")
        print(f"Middleware: Authenticated - {request.user.is_authenticated}")
