/* Lighthouse CI config — runs against local build artifacts */
module.exports = {
  ci: {
    collect: {
      staticDistDir: '.',
      url: [
        'http://localhost/index.html',
        'http://localhost/property.html',
        'http://localhost/reviews.html',
        'http://localhost/blog.html',
      ],
      numberOfRuns: 1,
    },
    assert: {
      assertions: {
        'categories:performance':   ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.95 }],
        'categories:best-practices':['warn', { minScore: 0.90 }],
        'categories:seo':           ['warn', { minScore: 0.90 }],
      },
    },
    upload: { target: 'temporary-public-storage' },
  },
};
