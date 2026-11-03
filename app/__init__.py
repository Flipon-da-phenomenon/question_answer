from flask import Flask, redirect, url_for


def create_app(config_object=None):
    app = Flask(__name__)
    app.config.from_object(config_object or "config.Config")

    from .blueprint import fp_game_bp

    app.register_blueprint(fp_game_bp, url_prefix=app.config["FP_URL_PREFIX"])

    @app.get("/")
    def home():
        return redirect(url_for("fp_game.index"))

    return app
