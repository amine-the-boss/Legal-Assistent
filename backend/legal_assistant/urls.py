# legal_assistant/urls.py

from django.urls import path
from .views import (
    ConversationHistoryView,
    LegalAssistantView,
    LoginView,
    LogoutView,
    SignupView,
    CreateConversationView,
    DeleteConversationView
)

urlpatterns = [
    path('conversation-history/', ConversationHistoryView.as_view(), name='conversation-history'),
    path('legal-assistant/', LegalAssistantView.as_view(), name='legal-assistant'),
    path('create-conversation/', CreateConversationView.as_view(), name='create-conversation'),
    path('delete-conversation/<int:conversation_id>/', DeleteConversationView.as_view(), name='delete_conversation'),
    path('login/', LoginView.as_view(), name='login'),
    path('logout/', LogoutView.as_view(), name='logout'),
    path('signup/', SignupView.as_view(), name='signup'),
]