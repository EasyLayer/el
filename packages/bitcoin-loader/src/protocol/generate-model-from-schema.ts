import { EntitySchema } from './schema';

export const generateModelFromSchema = (entitySchema: EntitySchema) => {
  const schemaOptions = entitySchema.options;
  const columns = schemaOptions.columns;

  class DynamicModel {
    constructor(initialValues?: Partial<Record<string, any>>) {
      // A local variable that will be hidden in the closure
      let operationsHistory: Array<{ method: string; params: any }> = [];

      if (initialValues) {
        Object.assign(this, initialValues);
      }

      this.insert = (values: Record<string, any>) => {
        operationsHistory.push({ method: 'insert', params: values });
        Object.assign(this, values);
      };

      this.update = (values: Record<string, any>, conditions: Record<string, any>) => {
        operationsHistory.push({ method: 'update', params: { values, conditions } });
        Object.assign(this, values);
      };

      this.delete = (conditions: Record<string, any>) => {
        operationsHistory.push({ method: 'delete', params: conditions });
      };

      this.getOperationsHistory = () => {
        return operationsHistory.slice();
      };

      this.clearOperationsHistory = () => {
        operationsHistory = [];
      };
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    insert(values: Record<string, any>) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    update(values: Record<string, any>, conditions: Record<string, any>) {}
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    delete(conditions: Record<string, any>) {}
    getOperationsHistory() {}
    clearOperationsHistory() {}
  }

  Object.keys(columns).forEach((fieldName) => {
    Object.defineProperty(DynamicModel.prototype, fieldName, {
      get() {
        return this[`_${fieldName}`];
      },
      set(values) {
        this[`_${fieldName}`] = values;
      },
      enumerable: true,
      configurable: true,
    });
  });

  Object.defineProperty(DynamicModel, 'name', { value: schemaOptions.name });

  return DynamicModel;
};
