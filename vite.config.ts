import adapter from '@sveltejs/adapter-node';
import { sveltekit } from '@sveltejs/kit/vite';
import mkcert from 'vite-plugin-mkcert';
import { defineConfig } from 'vite';

export default defineConfig({
	// `motion` n'est atteint que depuis `src/lib/**`, que le scanner de dépendances de SvelteKit
	// ne visite pas au démarrage (les routes sont découvertes à la demande). Il était donc trouvé
	// au premier chargement de /demo, déclenchant une re-optimisation à chaud — laquelle échoue en
	// EBUSY sur Windows au `rename(deps_temp → deps)`, après que Vite ait déjà supprimé `deps`.
	// Le pré-déclarer fait tout tenir dans la passe d'optimisation initiale.
	optimizeDeps: {
		include: ['motion']
	},
	plugins: [
		mkcert(),
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},

			// La démo est déployée sur Coolify, qui construit et lance le Dockerfile à la racine :
			// un serveur Node autonome (`node build`), pas une plateforme serverless. adapter-node
			// est donc le seul adapter qui produise la bonne sortie — adapter-auto ne détecte rien
			// dans un conteneur et se contente d'un avertissement, laissant `build/` sans serveur.
			adapter: adapter()
		})
	]
});
