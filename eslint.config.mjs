// Next.js 16 + ESLint 9 flat config minimum stub.
// boilerplate 후속 plan: eslint-config-next의 flat 지원 확립 후 next/core-web-vitals 적용.
export default [
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      'out/**',
      'build/**',
      'dist/**',
      'coverage/**',
      '.vercel/**',
    ],
  },
]
