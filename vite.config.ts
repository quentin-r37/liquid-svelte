import adapter from '@sveltejs/adapter-auto';
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

			// adapter-auto only supports some environments, see https://svelte.dev/docs/kit/adapter-auto for a list.
			// If your environment is not supported, or you settled on a specific environment, switch out the adapter.
			// See https://svelte.dev/docs/kit/adapters for more information about adapters.
			adapter: adapter()
		})
	]
});
