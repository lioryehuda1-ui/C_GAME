import streamlit as st
import streamlit.components.v1 as components
import os
import base64
from pathlib import Path

st.set_page_config(
    page_title="דין VS שון - פארק היורה!",
    page_icon="🦖",
    layout="wide",
    initial_sidebar_state="collapsed",
)

# Hide Streamlit UI elements
st.markdown("""
<style>
  #MainMenu, header, footer, .stAppDeployButton { visibility: hidden; }
  .stApp { background: #010801; }
  .block-container { padding: 0 !important; max-width: 100% !important; }
</style>
""", unsafe_allow_html=True)

def get_base64_image(image_path):
    try:
        with open(image_path, "rb") as img_file:
            return f"data:image/png;base64,{base64.b64encode(img_file.read()).decode()}"
    except Exception as e:
        return ""

# Directories
root_dir = Path(__file__).parent
game_dir = root_dir / "game"
static_dir = root_dir / "static"

# Load Core Game Files
html_content = (game_dir / "index.html").read_text(encoding="utf-8")
css_content  = (game_dir / "style.css").read_text(encoding="utf-8")
js_content   = (game_dir / "game.js").read_text(encoding="utf-8")

# Load and Encode Assets
dean_b64 = get_base64_image(static_dir / "dean.png")
shaun_b64 = get_base64_image(static_dir / "shaun.png")
dino_b64 = get_base64_image(static_dir / "dino.png")
jungle_b64 = get_base64_image(static_dir / "jungle.png")
pterodactyl_b64 = get_base64_image(static_dir / "pterodactyl.png")
raptor_b64 = get_base64_image(static_dir / "raptor.png")

# Inject Assets into HTML/CSS/JS
final_html = html_content \
    .replace('static/shaun.png', shaun_b64) \
    .replace('static/dean.png', dean_b64) \
    .replace('<link rel="stylesheet" href="style.css" />', f"<style>{css_content}</style>") \
    .replace('<script src="game.js"></script>', f"<script>{js_content}</script>")

# Inject Assets into the JS Image assignments
final_html = final_html.replace("IMAGES.p1.src = 'static/shaun.png';", f"IMAGES.p1.src = '{shaun_b64}';")
final_html = final_html.replace("IMAGES.p2.src = 'static/dean.png';", f"IMAGES.p2.src = '{dean_b64}';")
final_html = final_html.replace("IMAGES.dino.src = 'static/dino.png';", f"IMAGES.dino.src = '{dino_b64}';")
final_html = final_html.replace("IMAGES.bg.src = 'static/jungle.png';", f"IMAGES.bg.src = '{jungle_b64}';")
final_html = final_html.replace("IMAGES.pterodactyl.src = 'static/pterodactyl.png';", f"IMAGES.pterodactyl.src = '{pterodactyl_b64}';")
final_html = final_html.replace("IMAGES.raptor.src = 'static/raptor.png';", f"IMAGES.raptor.src = '{raptor_b64}';")

# Render
components.html(final_html, height=1000, scrolling=True)
