package com.ohgiraffers.order;

// 합성 학습용 파일입니다. 실제 수업 코드가 아니고 생성 책임이 아직 클래스 안에 있습니다.
public class OrderService {

    private final OrderRepository orderRepository;
    private final PaymentClient paymentClient;

    public OrderService() {
        // 여기서 직접 new 로 만들기 때문에 다른 구현으로 바꾸기 어렵습니다.
        this.orderRepository = new OrderRepository();
        this.paymentClient = new PaymentClient();
    }

    public Long placeOrder(String memberId, String itemCode, int quantity) {
        Order order = new Order(memberId, itemCode, quantity);
        Long orderId = orderRepository.save(order);
        paymentClient.request(orderId, order.totalPrice());
        return orderId;
    }

    public Order findOrder(Long orderId) {
        return orderRepository.findById(orderId);
    }
}
