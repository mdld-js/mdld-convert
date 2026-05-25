// vite.config.js
export default {
    build: {
        emptyOutDir: false,
        lib: {
            entry: 'cli.js',
            fileName: 'cli',
            formats: ['es'],
            outDir: 'dist',
        },

        rollupOptions: {
            external: ['fs'],  // bundle everything
        },
        codeSplitting: false  // single file output
    }
}