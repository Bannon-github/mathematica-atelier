# Mathematica Atelier

Interactive browser-based 3D mathematical surface visualization, parameter experiments, mathematical colour fields, history, image export and opt-in synthesized audio.

## Run locally

Serve this directory with a static HTTP server (for example `python -m http.server 8000`) and visit `http://localhost:8000`. The application requires internet access to load Three.js, Math.js and Google Fonts.

## Deploy to GitHub Pages

1. Create a public repository named `mathematica-atelier`.
2. Upload `index.html`, `README.md`, and `.github/workflows/pages.yml` to the `main` branch, preserving paths. Alternatively push this entire directory with git.
3. In repository Settings → Pages, set **Build and deployment → Source** to **GitHub Actions**.
4. Open Actions → Deploy Mathematica Atelier to GitHub Pages and confirm the deployment completes. If needed, run the workflow manually.
5. Your website will appear at `https://<github-username>.github.io/mathematica-atelier/`.

## Notes

This is a static client-side application. Expressions are evaluated in the browser. For performance, complex equations can cause slow frames. Audio requires a user click. GitHub Pages is public hosting, not a private service.
