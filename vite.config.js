// vite.config.js
export default {
    build: {
        lib: {
            entry: 'index.js',
            fileName: 'index',
            formats: ['es'],
            outDir: 'dist',
        },
        rollupOptions: {
            external: [],  // bundle everything
        },
        codeSplitting: false  // single file output
    }
}