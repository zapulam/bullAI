"""
bullAI Internal Chat - agent tools.

Written by: zapulam
"""

import base64
import calendar
import json
import time
import requests

from agents import function_tool
from bs4 import BeautifulSoup
from datetime import datetime, timedelta
from langchain_community.vectorstores import SQLiteVec
from typing import Annotated, Any, Dict, Optional, Tuple, List

from settings import settings


_openai_api_key = None
_client = None
_embeddings = None
_llm = None
_db = None
