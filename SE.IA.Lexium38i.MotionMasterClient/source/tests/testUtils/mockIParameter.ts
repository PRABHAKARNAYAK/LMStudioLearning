// Minimal valid IParameter mock for testing
export const createMockIParameter = (index: string, sub_index: string) => ({
  name: "",
  index,
  sub_index,
  unit: "",
  min: 0,
  max: 0,
  defaultData: 0,
  mandatory: false,
  description: "",
  inputType: "",
  isSmm: false,
  bitSize: 0,
  esiType: "",
  canBeMappedAsRxPdo: false,
  canBeMappedAsTxPdo: false,
  recordDescription: "",
  options: "",
  group: "",
  typeValue: "",
  originalOptions: "",
  value: 0,
  readOnly: false,
});

// Minimal test to satisfy Jest
describe("createMockIParameter", () => {
  it("should create a mock parameter with given index and sub_index", () => {
    const param = createMockIParameter("1000", "01");
    expect(param.index).toBe("1000");
    expect(param.sub_index).toBe("01");
    expect(param).toHaveProperty("name");
    expect(param).toHaveProperty("readOnly");
  });
});
