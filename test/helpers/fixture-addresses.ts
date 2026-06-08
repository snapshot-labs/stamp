import addresses from '../fixtures/addresses';

// A small, fixed subset of fixture addresses used to generate and assert
// deterministic resolver reference images. Keep this list stable: changing it
// requires regenerating the committed reference PNGs.
export const PIXEL_FIXTURE_ADDRESSES = [addresses[0], addresses[1]];
