from pydantic import ValidationError

def _ve_to_json(e: ValidationError):
    # make errors JSON-serializable and compact
    errs = []
    for err in e.errors():
        errs.append({
            "loc": list(err.get("loc", ())),
            "msg": str(err.get("msg", "")),
            "type": err.get("type", ""),
        })
    return {"message": "Invalid payload", "errors": errs}