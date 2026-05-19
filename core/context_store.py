from time import time
from uuid import uuid4


_CONTEXTS = {}
DEFAULT_TTL_SECONDS = 60 * 60
DEFAULT_EXPERIMENT_ID = "simple_linear_regression"


def create_context(data, ttl_seconds=DEFAULT_TTL_SECONDS):
    cleanup_expired()
    context_id = uuid4().hex
    stored_data = dict(data)
    stored_data.setdefault("experiment", DEFAULT_EXPERIMENT_ID)
    _CONTEXTS[context_id] = {
        "created_at": time(),
        "expires_at": time() + ttl_seconds if ttl_seconds else None,
        "data": stored_data,
    }
    return context_id


def get_context(context_id):
    cleanup_expired()
    item = _CONTEXTS.get(context_id)
    if not item:
        raise ValueError("训练上下文不存在或已过期")
    return item["data"]


def clear_context(context_id):
    _CONTEXTS.pop(context_id, None)


def cleanup_expired():
    now = time()
    expired = [
        context_id
        for context_id, item in _CONTEXTS.items()
        if item.get("expires_at") is not None and item["expires_at"] < now
    ]
    for context_id in expired:
        _CONTEXTS.pop(context_id, None)
