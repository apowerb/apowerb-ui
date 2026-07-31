build: {
  lib: {
    entry: path.resolve(__dirname, 'lib/index.jsx'),
    name: 'TH2Components',
    formats: ['umd'],
    fileName: () => 'components.js',
  },
  rollupOptions: {
    // Externalize React and ReactDOM - don't bundle them
    external: ['react', 'react-dom'],
    output: {
      globals: {
        react: 'React',
        'react-dom': 'ReactDOM'
      },
      assetFileNames: (assetInfo) => {
        if (assetInfo.name && assetInfo.name.endsWith('.css')) {
          return 'components.css';
        }
        return assetInfo.name || 'assets/[name]-[hash][extname]';
      },
    },
  },
  cssCodeSplit: false,
  outDir: 'dist',
  emptyOutDir: false,
  chunkSizeWarningLimit: 1000,
  minify: 'terser',
  sourcemap: true,
},