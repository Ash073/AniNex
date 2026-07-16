module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      // Only include necessary plugins for the new Expo Router
      'react-native-reanimated/plugin', // MUST be last
    ],
  };
};