import libTestDataTearDown from './node_modules/@agct/test-data/jest.teardown';
import libTestUtilsTearDown from './node_modules/@agct/test-utilities/src/jest.teardown';

const tearDown = async () => {
  await libTestDataTearDown();
  await libTestUtilsTearDown();
};

export default tearDown;
