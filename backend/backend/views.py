from django.http import JsonResponse

def api_root(request):
    return JsonResponse({"message": "Welcome to the Legal Assistant API"})