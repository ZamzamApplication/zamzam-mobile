module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    'react-native/no-raw-text': ['error', {skip: ['Txt']}],
  },
};
