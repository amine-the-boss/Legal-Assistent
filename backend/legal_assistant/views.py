#legal_assistant/views.py
from django.contrib.auth import login, logout, authenticate
from rest_framework import status
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from .services import (
    load_api_keys, initialize_llm, load_and_process_documents,
    get_prompt_template, get_reranked_result
)
from rest_framework.authtoken.models import Token
from .models import User, Conversation, Message
from .serializers import UserSerializer, ConversationSerializer
from langchain.chains.combine_documents import create_stuff_documents_chain
from langchain.chains import create_retrieval_chain
from langchain.retrievers import EnsembleRetriever
import time
from django.utils import timezone
import logging

logger = logging.getLogger(__name__)

class ConversationHistoryView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        user = request.user
        conversations = Conversation.objects.filter(user=user).order_by('-updated_at')
        serializer = ConversationSerializer(conversations, many=True)
        return Response(serializer.data)

class SignupView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            user = serializer.save()
            token, created = Token.objects.get_or_create(user=user)
            login(request, user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email
            }, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class LoginView(APIView):
    permission_classes = [AllowAny]

    def post(self, request):
        email = request.data.get('email')
        password = request.data.get('password')
        user = authenticate(request, username=email, password=password)
        if user is None:
            user = authenticate(request, username=email.split('@')[0], password=password)
        if user:
            login(request, user)
            token, created = Token.objects.get_or_create(user=user)
            return Response({
                'token': token.key,
                'user_id': user.pk,
                'email': user.email
            })
        return Response({'error': 'Invalid Credentials'}, status=status.HTTP_400_BAD_REQUEST)

class LogoutView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        logout(request)
        return Response(status=status.HTTP_200_OK)
    

class CreateConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        conversation = Conversation.objects.create(user=request.user)
        serializer = ConversationSerializer(conversation)
        return Response(serializer.data, status=status.HTTP_201_CREATED)
    
class DeleteConversationView(APIView):
    permission_classes = [IsAuthenticated]

    def delete(self, request, conversation_id):
        try:
            conversation = Conversation.objects.get(id=conversation_id, user=request.user)
            conversation.delete()
            return Response({"message": "Conversation deleted successfully"}, status=status.HTTP_200_OK)
        except Conversation.DoesNotExist:
            return Response({"error": "Conversation not found"}, status=status.HTTP_404_NOT_FOUND)

class LegalAssistantView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        language = request.data.get('language', 'French')
        prompt = request.data.get('prompt', '')
        conversation_id = request.data.get('conversation_id')

        if conversation_id:
            conversation = Conversation.objects.filter(id=conversation_id, user=request.user).first()
            if not conversation:
                conversation = Conversation.objects.create(user=request.user)
        else:
            conversation = Conversation.objects.create(user=request.user)

        Message.objects.create(conversation=conversation, content=prompt, role='user')

        chat_history = Message.objects.filter(conversation=conversation).order_by('timestamp')
        chat_history_str = "\n".join([f"{msg.role}: {msg.content}" for msg in chat_history])

        api_keys = load_api_keys()
        llm = initialize_llm(api_keys['groq'])
        vector_store, keyword_retriever = load_and_process_documents()
        prompt_template = get_prompt_template(language)
        document_chain = create_stuff_documents_chain(llm, prompt_template)

        vector_retriever = vector_store.as_retriever()
        hybrid_retriever = EnsembleRetriever(
            retrievers=[vector_retriever, keyword_retriever],
            weights=[0.4, 0.6]
        )

        retrieval_chain = create_retrieval_chain(hybrid_retriever, document_chain)

        start_time = time.process_time()
        response = retrieval_chain.invoke({
            "input": prompt,
            "chat_history": chat_history_str,
            "context": ""
        })
        end_time = time.process_time()

        Message.objects.create(conversation=conversation, content=response['answer'], role='assistant')
        
        conversation.updated_at = timezone.now()
        conversation.save()

        return Response({
            'answer': response['answer'],
            'response_time': end_time - start_time,
            'conversation_id': conversation.id
        })
        

