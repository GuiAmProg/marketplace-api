import { AggregateRoot } from './aggregate-root';

// Classe de teste: o AggregateRoot é abstrato e o `record` é protected,
// então precisamos de uma "filha" para poder usá-lo nos testes.
class FakeAggregate extends AggregateRoot {
  doSomething(at: Date) {
    this.record({ name: 'SomethingHappened', occurredAt: at });
  }
}

describe('AggregateRoot', () => {
  const at = new Date('2026-11-02T12:00:00Z');

  it('começa sem eventos', () => {
    expect(new FakeAggregate().pullEvents()).toEqual([]);
  });

  it('devolve os eventos registrados, na ordem em que ocorreram', () => {
    const aggregate = new FakeAggregate();

    aggregate.doSomething(at);
    aggregate.doSomething(at);

    const events = aggregate.pullEvents();
    expect(events).toHaveLength(2);
    expect(events[0].name).toBe('SomethingHappened');
  });

  it('esvazia a lista depois de retirar os eventos', () => {
    const aggregate = new FakeAggregate();
    aggregate.doSomething(at);

    aggregate.pullEvents();

    expect(aggregate.pullEvents()).toEqual([]);
  });
});