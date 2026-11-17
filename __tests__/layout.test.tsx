import React from 'react';
import renderer from 'react-test-renderer';
import RootLayout from '../app/_layout';

describe('RootLayout (_layout.tsx)', () => {
  it('renders correctly', () => {
    const tree = renderer.create(<RootLayout />).toJSON();
    expect(tree).toMatchSnapshot();
  });
});
