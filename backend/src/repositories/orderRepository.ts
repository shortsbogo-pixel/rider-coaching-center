import { loadParsedOrders } from "../services/excelService";

export const orderRepository = {
  async getAll() {
    return loadParsedOrders();
  },
  async getByWeek(weekKey: string) {
    return (await loadParsedOrders()).filter((order) => order.week === weekKey);
  },
  async getByRider(riderKey: string) {
    return (await loadParsedOrders()).filter((order) => order.riderName === riderKey || order.baseName === riderKey);
  },
  async getBySegment(segment: string) {
    return (await loadParsedOrders()).filter((order) => order.timeSegment === segment);
  },
  async getByDeliveryType(deliveryType: string) {
    return (await loadParsedOrders()).filter((order) => order.deliveryType === deliveryType);
  }
};
