const mockGetAccountDID = jest.fn();
const mockGet = jest.fn();

jest.mock('@self.id/core', () => ({
  Core: jest.fn().mockImplementation(() => ({
    getAccountDID: mockGetAccountDID,
    get: mockGet
  }))
}));

jest.mock('../../../../src/helpers/http', () => ({
  ...jest.requireActual('../../../../src/helpers/http'),
  fetchHttpImage: jest.fn()
}));

import { fetchHttpImage } from '../../../../src/helpers/http';
import resolve from '../../../../src/resolvers/image/selfid';

const mockedFetchHttpImage = jest.mocked(fetchHttpImage);
const ADDRESS = '0xeF8305E140ac520225DAf050e2f71d5fBcC543e7';

beforeEach(() => {
  mockGetAccountDID.mockReset().mockResolvedValue('did:pkh:eip155:1:0x0');
  mockGet.mockReset();
  mockedFetchHttpImage.mockReset();
});

describe('resolvers/image/selfid', () => {
  it('answers false when the profile carries no avatar', async () => {
    mockGet.mockResolvedValue({});

    await expect(resolve(ADDRESS)).resolves.toBe(false);
    expect(mockedFetchHttpImage).not.toHaveBeenCalled();
  });

  it('fetches a valid avatar url', async () => {
    mockGet.mockResolvedValue({ image: { original: { src: 'https://example.com/a.png' } } });
    const image = Buffer.from('avatar');
    mockedFetchHttpImage.mockResolvedValue(image);

    await expect(resolve(ADDRESS)).resolves.toBe(image);
    expect(mockedFetchHttpImage).toHaveBeenCalledWith('https://example.com/a.png');
  });

  it('answers false for an avatar reference that cannot become a fetchable URL', async () => {
    mockGet.mockResolvedValue({ image: { original: { src: 'http://' } } });

    await expect(resolve(ADDRESS)).resolves.toBe(false);
    expect(mockedFetchHttpImage).not.toHaveBeenCalled();
  });
});
