// vite.config.js
export default {
    build: {
        lib: {
            entry: 'index.js',
            fileName: 'mdld-convert.js',
            formats: ['es'],
            outDir: 'dist',
        },
        rollupOptions: {
            external: [],  // bundle everything
        },
        codeSplitting: false  // single file output
    }
}