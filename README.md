# Mathematica Atelier | Modular edition

A modular multi-workspace interface. The 3D canvas remains active while users navigate **Equations**, **Appearance**, **Motion**, and **Audio Studio**. Settings are grouped by workspace rather than crowded into one page. The app is divided into independent CSS and JavaScript files, and the navigation is a standalone module.

## File layout

- `index.html` - lightweight application shell
- `assets/css/atelier.css` - theme, responsive layout and panel styling
- `assets/js/app.js` - existing 3D renderer, math engine, colour, time and audio features
- `assets/js/modules/panels.js` - collapsible panel creation
- `assets/js/modules/navigation.js` - workspace routing, sidebar grouping and URL hashes

## Deploy

Upload the **entire directory tree** to the root of the `Bannon-github/mathematica-atelier` GitHub repository. GitHub Pages can use the included workflow if configured for GitHub Actions. Keep the relative file paths unchanged. The external Three.js and math.js libraries require network access.

## Architecture notes

This is a modular interface and code layout, not separate HTML page reloads. Keeping a single persistent canvas avoids losing camera position, audio and animation state when changing workspaces. The renderer is still one app module and can be further separated into rendering, math, automation and audio modules as the project grows.
