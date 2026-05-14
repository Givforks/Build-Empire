/// <reference types="vite/client" />

interface ImportMetaEnv {
	readonly VITE_SHOW_EMPIRE_SECTION?: string;
}

interface ImportMeta {
	readonly env: ImportMetaEnv;
}
