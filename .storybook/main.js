module.exports = {
  "stories": [
    "../src/**/*.stories.mdx",
    "../src/**/*.stories.@(js|jsx|ts|tsx)"
  ],
  addons: [
    "@storybook/addon-links",
    "@storybook/addon-essentials"
  ],
  reactOptions: {
    fastRefresh: true,
    strictMode: true,
  },
  core: {
    builder: "webpack5",
  },
  typescript: {
    reactDocgen: 'react-docgen-typescript',
    reactDocgenTypescriptOptions: {
      compilerOptions: {
        shouldExtractLiteralValuesFromEnum: true,
        allowSyntheticDefaultImports: true
      },
    }
  }
}
