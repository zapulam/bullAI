"""
Session/turn context and memory.

Written by: zapulam
"""

from agents.items import TResponseInputItem
from agents.run import ModelInputData
from repositories import SettingsRepository


def build_memory(settings_repo: SettingsRepository) -> str:
    """Build the system message block containing user memories and preferences."""
    memory_content = settings_repo.get_user_memory()
    memories_block = ""
    if memory_content and memory_content.strip():
        memories_block = "\n\n## User Memories\n" + memory_content.strip()

    prefs = []
    chart_type = settings_repo.get_preferred_chart_type()
    if chart_type:
        prefs.append(f"Preferred chart type unless otherwise specified: {chart_type}")

    time_series = settings_repo.get_default_time_series()
    if time_series:
        prefs.append(f"Default time series for price charts unless otherwise specified: {time_series}")

    indicator = settings_repo.get_default_technical_indicator()
    if indicator and indicator != "none":
        prefs.append(f"Add this technical indicator by default to price charts unless otherwise specified: {indicator}")

    verbosity = settings_repo.get_response_verbosity()
    if verbosity == "brief":
        prefs.append("Response style: Be very concise. Use 1-3 bullets per section. Minimize interpretation.")
    elif verbosity == "detailed":
        prefs.append("Response style: Provide thorough analysis. Expand each section with more context and examples.")

    if prefs:
        memories_block += "\n\n## User Preferences\n" + "\n".join(prefs)

    return memories_block


def create_cb(memories_block: str):
    """
    Create a call_model_input_filter that adds memories as a system message before user input, only at the start of the turn.
    """   
    def _filter(payload):
        nonlocal has_added
        if not memories_block or has_added:
            return payload.model_data
        has_added = True
        memories_message: TResponseInputItem = {
            "role": "system",
            "content": memories_block,
        }
        new_input = [memories_message] + list(payload.model_data.input)
        return ModelInputData(
            input=new_input,
            instructions=payload.model_data.instructions,
        )

    has_added = False

    return _filter
