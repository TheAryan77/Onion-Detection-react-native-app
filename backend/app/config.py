from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    roboflow_api_key: str = ""
    roboflow_model_id: str = "onions-ciqkj/3"
    roboflow_api_url: str = "https://serverless.roboflow.com"
    # Keep the server-side threshold low; per-class thresholds are applied from grading_rules.json
    roboflow_confidence: int = 25
    roboflow_overlap: int = 30

    # Assistant chat (Google Gemini). The key stays on the server like the Roboflow key.
    gemini_api_key: str = ""
    gemini_model: str = "gemini-3.8-flash"
    # Tried in order when the main model is overloaded (Gemini returns 503/429 at busy times)
    gemini_fallback_models: str = "gemini-3.5-flash,gemini-3.1-flash-lite"
    gemini_api_url: str = "https://generativelanguage.googleapis.com/v1beta"

    mock_mode: bool = False
    max_image_side: int = 1280


settings = Settings()
