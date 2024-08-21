import { defineConfig } from 'astro/config';
import starlight from '@astrojs/starlight';

// https://astro.build/config
export default defineConfig({
	integrations: [
		starlight({
			title: 'Lion',
			description: 'The Accessible Design System Engine',
			social: {
				github: 'https://github.com/ing-bank/lion',
				twitter: 'https://twitter.com/lion'
			},
			sidebar: [
				{
					label: 'Guides',
					items: [
						// Each item here is one entry in the navigation menu.
						{ label: 'Get Started', slug: 'guides/get-started' },
						{ label: 'Philosophy', slug: 'guides/philosophy' },
					],
				},
				{
					label: 'Reference',
					autogenerate: { directory: 'reference' },
				},
			],
		}),
	],
});
