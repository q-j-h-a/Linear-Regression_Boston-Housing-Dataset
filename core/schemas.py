def collect_panel_defaults(panel):
    defaults = {}
    for section in panel.get("sections", []):
        for control in section.get("controls", []):
            if "default" in control and "name" in control:
                defaults[control["name"]] = control["default"]
            elif "default_source" in control and "name" in control:
                defaults[control["name"]] = {"source": control["default_source"]}
    return defaults
