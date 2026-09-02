// Sample lesson for the side panel kit: 3교시 · IoC 컨테이너와 의존성 주입. Times are class-clock times; `at` = seconds after the demo starts.
(() => {
const T = (id, at, time, parts, now) => ({ id, at, time, now, segments: parts.map(p => Array.isArray(p) ? { text: p[0], term: true } : { text: p }) });
const TRANSCRIPT = [
  T('l1', -54, '10:31:24', ['지금까지는 필요한 객체를 ', ['new'], '로 만들어 썼습니다.']),
  T('l2', -31, '10:31:47', [['OrderService'], '가 ', ['OrderRepository'], '를 직접 만들고 있죠.']),
  T('l3', -18, '10:32:00', ['객체를 직접 ', ['new'], '로 만들면 클래스끼리 ', ['강하게 묶입니다'], '.']),
  T('l4', 0, '10:32:18', ['이제 ', ['생성 책임'], '을 ', ['컨테이너'], '에 맡겨 볼게요.']),
  T('l5', 23, '10:32:41', [['생성자'], '로 받으면 어떤 ', ['구현'], '이 오든 상관없어지죠.'], '생성자 주입 코드로 넘어갔어요'),
  T('l6', 47, '10:33:05', ['그래서 ', ['final'], '을 붙여서 한 번 받은 뒤엔 바꾸지 못하게 합니다.']),
  T('l7', 72, '10:33:30', ['이걸 ', ['생성자 주입'], '이라고 부르고, 스프링이 권장하는 방식이에요.']),
  T('l8', 97, '10:33:55', [['@Autowired'], '는 생성자가 하나면 생략해도 됩니다.']),
  T('l9', 122, '10:34:20', ['이제 ', ['테스트'], ' 코드에서 가짜 ', ['리포지토리'], '를 넣어 볼게요.'], '테스트 코드로 넘어갔어요'),
];

const CODE = {
  teacher: `@Service
public class OrderService {
  private final OrderRepository repo;

  public OrderService(OrderRepository repo) {
    this.repo = repo;
  }
}`,
  mine: `@Service
public class OrderService {
  private OrderRepository repo = new OrderRepository();

  public void order() {
    repo.save();
  }
}`,
};
const CMP_NEW = [{ who: '선생님', code: 'private final OrderRepository repo;', tone: 'teacher' }, { who: '내 코드', code: '… repo = new OrderRepository();', tone: 'mine' }];

// One entry per tappable term. conclusion ≤ 40자 where possible; easier = "더 쉽게"; why = "왜 필요한데?"
const A = (conclusion, easier, why, evidence, extra) => ({ conclusion, easier, why, evidence, ...extra });
const ANSWERS = {
  'new': A('new 자체가 틀린 건 아니지만, 객체를 바꾸거나 테스트하기 어려워져서 생성 책임을 분리해요.', '내가 직접 만들면 나중에 다른 걸로 바꾸기 힘들어요. 그래서 만드는 일을 남에게 맡겨요.', '리포지토리를 가짜로 바꿔 테스트하려면, OrderService 안에서 new로 박아 둔 걸 매번 고쳐야 해요.', [{ type: 'verified', source: 'tiro' }, { type: 'partial', source: 'meet' }, { type: 'inferred', reason: '테스트 이야기' }], { compare: CMP_NEW, guesses: [{ id: 'g1', label: '왜 new로 직접 만들면 안 되는지' }, { id: 'g2', label: '강하게 묶인다는 게 무슨 뜻인지' }, { id: 'g3', label: '그럼 누가 만들어 주는지' }] }),
  '강하게 묶입니다': A('한 클래스가 다른 클래스의 구체적인 이름을 알고 직접 만들면, 둘을 따로 떼어 쓸 수 없다는 뜻이에요.', '레고 두 조각을 접착제로 붙인 상태예요. 하나만 바꾸고 싶어도 같이 떼어 내야 해요.', '나중에 OrderRepository를 다른 것으로 바꾸거나 테스트에서 가짜로 갈아 끼우려면 OrderService까지 고쳐야 해요.', [{ type: 'verified', source: 'tiro' }, { type: 'inferred', reason: '"결합도"라는 말은 아직 안 나와서' }]),
  '생성 책임': A('객체를 "누가 만드느냐"의 책임이에요. 지금까지는 OrderService가, 이제부터는 컨테이너가 맡아요.', '만드는 일을 누가 하느냐는 얘기예요. 내가 아니라 스프링이 해요.', '만드는 일이 흩어져 있으면 바꿀 때마다 여기저기 고쳐야 하니까 한곳에 모아요.', [{ type: 'verified', source: 'tiro' }]),
  '컨테이너': A('컨테이너는 스프링이 객체를 만들어 담아 두고 필요한 곳에 넣어 주는 보관함이에요.', '객체 창고예요. 필요하다고 말하면 꺼내 줘요.', 'new를 직접 안 쓰려면 누군가는 만들어야 하는데, 그 역할을 스프링 컨테이너가 해요.', [{ type: 'verified', source: 'tiro' }, { type: 'inferred', reason: '화면에 IoC라는 단어만 있어서' }]),
  '생성자': A('생성자는 객체가 만들어질 때 딱 한 번 실행되는 특별한 메서드예요. 클래스 이름과 같아요.', '객체가 태어날 때 한 번 실행되는 함수예요.', '필요한 걸 태어날 때 받아 두면 이후엔 빠질 일이 없어요.', [{ type: 'verified', source: 'meet' }, { type: 'verified', source: 'tiro' }], { compare: [{ who: '선생님', code: 'public OrderService(OrderRepository repo) {', tone: 'teacher' }, { who: '내 코드', code: '(생성자 없음)', tone: 'mine' }] }),
  '구현': A('구현은 인터페이스라는 약속을 실제로 채운 클래스예요. 어떤 구현이 와도 생성자는 그대로예요.', '약속(인터페이스)을 진짜로 지키는 클래스예요.', '구현을 바꿔 끼울 수 있어야 테스트용 가짜도 넣을 수 있어요.', [{ type: 'verified', source: 'tiro' }, { type: 'inferred', reason: '인터페이스는 1교시 내용이라' }]),
  'final': A('final은 한 번 값을 넣으면 다시 바꿀 수 없게 막는 표시예요.', '한 번 정하면 못 바꾸는 자물쇠예요.', '리포지토리가 중간에 바뀌면 찾기 힘든 버그가 돼요. 못 바꾸게 막는 게 안전해요.', [{ type: 'verified', source: 'tiro' }, { type: 'verified', source: 'meet' }]),
  '생성자 주입': A('생성자 주입은 필요한 객체를 생성자의 매개변수로 받는 방식이에요.', '만들어질 때 필요한 걸 손에 쥐고 태어나는 방식이에요.', '필드에 @Autowired를 붙이는 것보다 빠진 게 있으면 바로 알 수 있고 테스트가 쉬워요.', [{ type: 'verified', source: 'tiro' }, { type: 'verified', source: 'meet' }], { compare: CMP_NEW }),
  '@Autowired': A('@Autowired는 스프링에게 "여기에 맞는 객체를 넣어 줘"라고 표시하는 애노테이션이에요.', '스프링한테 "이거 채워 줘" 하고 붙이는 딱지예요.', '생성자가 하나뿐이면 스프링이 알아서 넣어 주니까 생략해도 돼요.', [{ type: 'verified', source: 'tiro' }, { type: 'delayed', source: 'intellij' }]),
  '테스트': A('테스트 코드는 내 코드가 맞게 동작하는지 자동으로 확인하는 코드예요.', '내 코드를 대신 눌러 보고 결과를 확인해 주는 코드예요.', '가짜 리포지토리를 넣을 수 있어야 DB 없이도 빠르게 확인할 수 있어요.', [{ type: 'verified', source: 'tiro' }]),
  '리포지토리': A('리포지토리는 데이터를 저장하고 꺼내는 일을 맡은 객체예요.', 'DB랑 이야기하는 담당이에요.', '저장 방법이 바뀌어도 서비스 코드는 그대로 두려고 따로 떼어 놔요.', [{ type: 'verified', source: 'tiro' }, { type: 'partial', source: 'meet' }]),
  'OrderService': A('OrderService는 주문 관련 일을 처리하는 클래스예요. 지금 선생님이 고치고 있는 파일이에요.', '주문 담당 클래스예요.', '서비스는 일의 순서를 맡고, 저장은 리포지토리에게 맡겨요.', [{ type: 'verified', source: 'meet' }]),
  'OrderRepository': A('OrderRepository는 주문 데이터를 저장하고 찾는 클래스예요.', '주문을 저장하는 담당이에요.', 'OrderService가 이걸 직접 만들면 둘이 강하게 묶여요.', [{ type: 'verified', source: 'meet' }, { type: 'verified', source: 'tiro' }]),
};
const SENTENCE_GUESSES = {
  l1: [{ id: 'g1', label: 'new가 정확히 무엇을 하는지' }, { id: 'g2', label: '왜 "지금까지는"이라고 말하는지' }],
  l2: [{ id: 'g1', label: 'OrderService와 OrderRepository 관계' }, { id: 'g2', label: '"직접 만든다"는 코드가 어디인지' }],
  l3: ANSWERS['new'].guesses,
  l4: [{ id: 'g1', label: '생성 책임이 무슨 뜻인지' }, { id: 'g2', label: '컨테이너가 무엇인지' }, { id: 'g3', label: '맡기면 코드가 어떻게 바뀌는지' }],
  l5: [{ id: 'g1', label: '생성자가 무엇인지' }, { id: 'g2', label: '구현이 무슨 뜻인지' }, { id: 'g3', label: '왜 상관없어지는지' }],
  l6: [{ id: 'g1', label: 'final은 왜 붙이는지' }, { id: 'g2', label: '바꾸지 못하게 하는 게 왜 좋은지' }],
  l7: [{ id: 'g1', label: '생성자 주입이 무엇인지' }, { id: 'g2', label: '다른 주입 방식은 무엇인지' }],
  l8: [{ id: 'g1', label: '@Autowired가 무엇인지' }, { id: 'g2', label: '왜 생략해도 되는지' }],
  l9: [{ id: 'g1', label: '테스트 코드가 무엇인지' }, { id: 'g2', label: '가짜 리포지토리를 왜 넣는지' }],
};
// guess id → the term whose answer applies
const GUESS_TERM = { l1: ['new', 'new'], l2: ['OrderService', 'OrderRepository'], l3: ['new', '강하게 묶입니다', '컨테이너'], l4: ['생성 책임', '컨테이너', '생성자 주입'], l5: ['생성자', '구현', '구현'], l6: ['final', 'final'], l7: ['생성자 주입', '@Autowired'], l8: ['@Autowired', '@Autowired'], l9: ['테스트', '리포지토리'] };

Object.assign(window, { CM_TRANSCRIPT: TRANSCRIPT, CM_ANSWERS: ANSWERS, CM_CODE: CODE, CM_SENTENCE_GUESSES: SENTENCE_GUESSES, CM_GUESS_TERM: GUESS_TERM });
})();
