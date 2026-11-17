import React from 'react';
import renderer from 'react-test-renderer';
import LoadingScreen from '../app/index';

describe('LoadingScreen (index.tsx)', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<LoadingScreen />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
