# legal_assistant/services.py

from langchain_community.retrievers import BM25Retriever
from langchain_community.document_loaders import PyPDFDirectoryLoader
import os
from typing import List, Dict, Tuple
from langchain_groq import ChatGroq
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_core.prompts import ChatPromptTemplate
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from dotenv import load_dotenv
from flashrank.Ranker import Ranker, RerankRequest
from django.conf import settings
import logging

logger = logging.getLogger(__name__)

load_dotenv()

# Global variables to store vector store and keyword retriever
vector_store = None
keyword_retriever = None

def get_vector_store_path() -> str:
    return settings.VECTOR_STORE_PATH

def load_api_keys() -> Dict[str, str]:
    """Load and return API keys."""
    return {
        'groq': os.getenv('GROQ_API_KEY'),
        'google': os.getenv('GOOGLE_API_KEY')
    }

def initialize_llm(api_key: str) -> ChatGroq:
    """Initialize and return the language model."""
    return ChatGroq(groq_api_key=api_key, model_name=settings.MODEL_NAME)

def get_prompt_template(language: str) -> ChatPromptTemplate:
    """Return the prompt template based on the selected language."""
    templates = {
        "French": """
        Vous êtes un expert juridique chevronné, doté d'une capacité exceptionnelle à expliquer des concepts juridiques complexes de manière simple et accessible. Votre mission est de répondre à une question juridique en français, en vous basant sur le contexte fourni et l'historique de la conversation.

        Directives :
        1. Expliquez les concepts juridiques pertinents en utilisant un langage clair, précis et exempt de jargon technique. Si vous devez utiliser des termes juridiques, définissez-les simplement.
        2. Utilisez des analogies ou des exemples de la vie quotidienne pour illustrer les points complexes.
        3. Si la question concerne une loi spécifique, expliquez brièvement son objectif et ses implications pratiques.
        4. Structurez votre réponse de manière logique, en utilisant des puces ou des numéros si nécessaire pour améliorer la clarté.
        5. Pour les procédures judiciaires, décrivez les étapes clés de manière séquentielle et compréhensible.
        6. Concluez par un résumé concis des points principaux.

        Votre objectif est de permettre à une personne sans formation juridique de comprendre pleinement la réponse et de se sentir plus informée et confiante face à la question juridique posée.
        
        Historique de la conversation :
        {chat_history}

        <context>
        {context}
        </context>

        Question : {input}

        Réponse :
        """,
        "English": """
        You are a seasoned legal expert with an exceptional ability to explain complex legal concepts in a simple and accessible manner. Your mission is to answer a legal question in English, based on the provided context and conversation history.

        Guidelines:
        1. Explain relevant legal concepts using clear, precise language free of technical jargon. If you must use legal terms, define them simply.
        2. Use analogies or everyday examples to illustrate complex points.
        3. Structure your response logically, using bullet points or numbers if necessary to improve clarity.
        4. If the question concerns a specific law, briefly explain its purpose and practical implications.
        5. For court procedures, describe the key steps sequentially and comprehensibly.
        6. Anticipate potential follow-up questions and address them proactively.
        7. Conclude with a concise summary of the main points.

        Your goal is to enable a person without legal training to fully understand the answer and feel more informed and confident about the legal question at hand.

        Conversation history:
        {chat_history}
        
        <context>
        {context}
        </context>

        Question: {input}

        Answer:
        """,
        "عربي": """
        أنت خبير قانوني متمرس ولديك قدرة استثنائية على شرح المفاهيم القانونية المعقدة بطريقة بسيطة وسهلة المنال. مهمتك هي الإجابة على سؤال قانوني باللغة العربية، بناءً على السياق المقدم وتاريخ المحادثة.

 القواعد الارشادية:
 1. شرح المفاهيم القانونية ذات الصلة باستخدام لغة واضحة ودقيقة خالية من المصطلحات الفنية. إذا كان يجب عليك استخدام المصطلحات القانونية، فقم بتعريفها ببساطة.
 2. استخدم القياسات أو الأمثلة اليومية لتوضيح النقاط المعقدة.
 3. قم بتنظيم إجابتك بشكل منطقي، باستخدام النقاط أو الأرقام إذا لزم الأمر لتحسين الوضوح.
 4. إذا كان السؤال يتعلق بقانون محدد، اشرح بإيجاز غرضه وآثاره العملية.
 5. بالنسبة لإجراءات المحكمة، قم بوصف الخطوات الأساسية بشكل تسلسلي ومفهوم.
 6. توقع أسئلة المتابعة المحتملة وتعامل معها بشكل استباقي.
 7. اختتم بملخص موجز للنقاط الرئيسية.
 8. أنت لا تعرف إلا اللغة العربية ولا تستطيع التحدث بأي لغة أخرى.  

 هدفك هو تمكين الشخص الذي ليس لديه تدريب قانوني من فهم الإجابة بشكل كامل والشعور بمزيد من المعرفة والثقة بشأن السؤال القانوني المطروح.
       
        سجل المحادثة:
        {chat_history}
       
        <سياق>
        {context}
        </سياق>

        سؤال : {input}

        إجابة:
        """
    }
    return ChatPromptTemplate.from_template(templates[language])

def load_and_process_documents() -> Tuple[FAISS, BM25Retriever]:
    global vector_store, keyword_retriever
    
    vector_store_path = get_vector_store_path()
    
    if vector_store is not None and keyword_retriever is not None:
        logger.info("Using cached vector store and keyword retriever")
        return vector_store, keyword_retriever

    try:
        embeddings = GoogleGenerativeAIEmbeddings(model="models/embedding-001")
        
        # Try to load existing vector store
        if os.path.exists(os.path.join(vector_store_path, "index.faiss")):
            logger.info(f"Loading existing vector store from {vector_store_path}")
            vector_store = FAISS.load_local(vector_store_path, embeddings, allow_dangerous_deserialization=True)
            
            # We need to reload documents for BM25Retriever
            loader = PyPDFDirectoryLoader(settings.DOCS_PATH)
            docs = loader.load()
            text_splitter = RecursiveCharacterTextSplitter(chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
            final_documents = text_splitter.split_documents(docs)
        else:
            logger.info("Creating new vector store")
            loader = PyPDFDirectoryLoader(settings.DOCS_PATH)
            docs = loader.load()
            logger.info(f"Loaded {len(docs)} documents from {settings.DOCS_PATH}")

            text_splitter = RecursiveCharacterTextSplitter(chunk_size=settings.CHUNK_SIZE, chunk_overlap=settings.CHUNK_OVERLAP)
            final_documents = text_splitter.split_documents(docs)
            logger.info(f"Split documents into {len(final_documents)} chunks")

            vector_store = FAISS.from_documents(final_documents, embeddings)
            
            # Save the vector store
            vector_store.save_local(vector_store_path)
            logger.info(f"Saved vector store to {vector_store_path}")

        # Create keyword retriever (doesn't need to be saved as it's recreated quickly)
        keyword_retriever = BM25Retriever.from_documents(final_documents)
        logger.info("Created BM25 retriever")

        return vector_store, keyword_retriever
    except Exception as e:
        logger.error(f"Error in load_and_process_documents: {str(e)}", exc_info=True)
        raise

def get_reranked_result(query: str, passages: List[Dict], choice: str) -> List[Dict]:
    model_map = {
        "Nano": "",
        "Small": "ms-marco-MiniLM-L-12-v2",
        "Medium": "rank-T5-flan",
        "Large": "ms-marco-MultiBERT-L-12"
    }
    ranker = Ranker(model_name=model_map[choice], cache_dir=settings.CACHE_DIR) if choice != "Nano" else Ranker()
    rerank_request = RerankRequest(query=query, passages=passages)
    return ranker.rerank(rerank_request)