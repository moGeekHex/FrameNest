/**
 * @license
 * Copyright Google Inc. All Rights Reserved.
 *
 * Use of this source code is governed by an MIT-style license that can be
 * found in the LICENSE file at https://angular.io/license
 */

import 'reflect-metadata';

import {
  Inject,
  Injectable,
  InjectionToken,
  Injector,
  Optional,
  Provider,
  ReflectiveInjector,
  ReflectiveKey,
  Self,
  forwardRef,
} from '../../di';
import { ReflectiveInjector_ } from '../../di/reflective-injector';
import { ResolvedReflectiveProvider_ } from '../../di/reflective-provider';
import { getOriginalError } from '../../di/facade/errors';

import { isPresent, stringify } from '../../di/facade/lang';
import { expect } from 'chai';
import { debug } from 'util';

class Engine {}

class BrokenEngine {
  constructor() {
    throw new Error('Broken Engine');
  }
}

class DashboardSoftware {}

@Injectable()
class Dashboard {
  constructor(software: DashboardSoftware) {}
}

class TurboEngine extends Engine {}

@Injectable()
class Car {
  constructor(public engine: Engine) {}
}

@Injectable()
class CarWithOptionalEngine {
  constructor(@Optional() public engine: Engine) {}
}

@Injectable()
class CarWithDashboard {
  engine: Engine;
  dashboard: Dashboard;
  constructor(engine: Engine, dashboard: Dashboard) {
    this.engine = engine;
    this.dashboard = dashboard;
  }
}

@Injectable()
class SportsCar extends Car {}

@Injectable()
class CarWithInject {
  constructor(@Inject(TurboEngine) public engine: Engine) {}
}

@Injectable()
class CyclicEngine {
  constructor(car: Car) {}
}

class NoAnnotations {
  constructor(secretDependency: any) {}
}

function factoryFn(a: any) {}

const dynamicProviders = [
  { provide: 'provider0', useValue: 1 },
  { provide: 'provider1', useValue: 1 },
  { provide: 'provider2', useValue: 1 },
  { provide: 'provider3', useValue: 1 },
  { provide: 'provider4', useValue: 1 },
  { provide: 'provider5', useValue: 1 },
  { provide: 'provider6', useValue: 1 },
  { provide: 'provider7', useValue: 1 },
  { provide: 'provider8', useValue: 1 },
  { provide: 'provider9', useValue: 1 },
  { provide: 'provider10', useValue: 1 },
];

function createInjector(
  providers: Provider[],
  parent: ReflectiveInjector = null,
): ReflectiveInjector_ {
  const resolvedProviders = ReflectiveInjector.resolve(providers.concat(dynamicProviders));
  if (isPresent(parent)) {
    return parent.createChildFromResolved(resolvedProviders) as ReflectiveInjector_;
  } else {
    return ReflectiveInjector.fromResolvedProviders(resolvedProviders) as ReflectiveInjector_;
  }
}

describe(`injector`, () => {
  it('should instantiate a class without dependencies', () => {
    const injector = createInjector([Engine]);
    const engine = injector.get(Engine);
    expect(engine instanceof Engine).to.be.true;
  });

  it('should resolve dependencies based on type information', () => {
    const injector = createInjector([Engine, Car]);
    const car = injector.get(Car);

    expect(car instanceof Car).to.be.true;
    expect(car.engine instanceof Engine).to.be.true;
  });

  it('should resolve dependencies based on @Inject annotation', () => {
    const injector = createInjector([TurboEngine, Engine, CarWithInject]);
    const car = injector.get(CarWithInject);

    expect(car instanceof CarWithInject).to.be.true;
    expect(car.engine instanceof TurboEngine).to.be.true;
  });

  it('should throw when no type and not @Inject (class case)', () => {
    expect(() => createInjector([NoAnnotations])).to.Throw(
      'Cannot resolve all parameters for \'NoAnnotations\'(?). ' +
        'Make sure that all the parameters are decorated with Inject or have valid type annotations ' +
        'and that \'NoAnnotations\' is decorated with Injectable.',
    );
  });

  it('should throw when no type and not @Inject (factory case)', () => {
    expect(() => createInjector([{ provide: 'someToken', useFactory: factoryFn }])).to.Throw(
      'Cannot resolve all parameters for \'factoryFn\'(?). ' +
        'Make sure that all the parameters are decorated with Inject or have valid type annotations ' +
        'and that \'factoryFn\' is decorated with Injectable.',
    );
  });

  it('should cache instances', () => {
    const injector = createInjector([Engine]);

    const e1 = injector.get(Engine);
    const e2 = injector.get(Engine);

    expect(e1).to.equal(e2);
  });

  it('should provide to a value', () => {
    const injector = createInjector([{ provide: Engine, useValue: 'fake engine' }]);

    const engine = injector.get(Engine);
    expect(engine).to.equal('fake engine');
  });

  it('should inject dependencies instance of InjectionToken', () => {
    const TOKEN = new InjectionToken<string>('token');

    const injector = createInjector([
      { provide: TOKEN, useValue: 'by token' },
      { provide: Engine, useFactory: (v: string) => v, deps: [[TOKEN]] },
    ]);

    const engine = injector.get(Engine);
    expect(engine).to.equal('by token');
  });

  it('should provide to a factory', () => {
    function sportsCarFactory(e: any) {
      return new SportsCar(e);
    }

    const injector = createInjector([
      Engine,
      { provide: Car, useFactory: sportsCarFactory, deps: [Engine] },
    ]);

    const car = injector.get(Car);
    expect(car instanceof SportsCar).to.be.true;
    expect(car.engine instanceof Engine).to.be.true;
  });

  it('should supporting provider to null', () => {
    const injector = createInjector([{ provide: Engine, useValue: null }]);
    const engine = injector.get(Engine);
    expect(engine).to.be.null;
  });

  it('should provide to an alias', () => {
    const injector = createInjector([
      Engine,
      { provide: SportsCar, useClass: SportsCar },
      { provide: Car, useExisting: SportsCar },
    ]);

    const car = injector.get(Car);
    const sportsCar = injector.get(SportsCar);
    expect(car instanceof SportsCar).to.be.true;
    expect(car).to.equal(sportsCar);
  });

  it('should support multiProviders', () => {
    const injector = createInjector([
      Engine,
      { provide: Car, useClass: SportsCar, multi: true },
      { provide: Car, useClass: CarWithOptionalEngine, multi: true },
    ]);

    const cars = injector.get(Car);
    expect(cars.length).to.equal(2);
    expect(cars[0] instanceof SportsCar).to.be.true;
    expect(cars[1] instanceof CarWithOptionalEngine).to.be.true;
  });

  it('should support multiProviders that are created using useExisting', () => {
    const injector = createInjector([
      Engine,
      SportsCar,
      { provide: Car, useExisting: SportsCar, multi: true },
    ]);

    const cars = injector.get(Car);
    expect(cars.length).to.equal(1);
    expect(cars[0]).to.equal(injector.get(SportsCar));
  });

  it('should throw when the aliased provider does not exist', () => {
    const injector = createInjector([{ provide: 'car', useExisting: SportsCar }]);
    const e = `No provider for ${stringify(SportsCar)}! (car -> ${stringify(SportsCar)})`;
    expect(() => injector.get('car')).to.Throw(e);
  });

  it('should handle forwardRef in useExisting', () => {
    const injector = createInjector([
      { provide: 'originalEngine', useClass: forwardRef(() => Engine) },
      { provide: 'aliasedEngine', useExisting: forwardRef(() => 'originalEngine') as any },
    ]);
    expect(injector.get('aliasedEngine') instanceof Engine).to.be.true;
  });

  it('should support overriding factory dependencies', () => {
    const injector = createInjector([
      Engine,
      { provide: Car, useFactory: (e: Engine) => new SportsCar(e), deps: [Engine] },
    ]);

    const car = injector.get(Car);
    expect(car instanceof SportsCar).to.be.true;
    expect(car.engine instanceof Engine).to.be.true;
  });

  it('should support optional dependencies', () => {
    const injector = createInjector([CarWithOptionalEngine]);

    const car = injector.get(CarWithOptionalEngine);
    expect(car.engine).to.equal(null);
  });

  it('should flatten passed-in providers', () => {
    const injector = createInjector([[[Engine, Car]]]);

    const car = injector.get(Car);
    expect(car instanceof Car).to.be.true;
  });

  it('should use the last provider when there are multiple providers for same token', () => {
    const injector = createInjector([
      { provide: Engine, useClass: Engine },
      { provide: Engine, useClass: TurboEngine },
    ]);

    expect(injector.get(Engine) instanceof TurboEngine).to.be.true;
  });

  it('should use non-type tokens', () => {
    const injector = createInjector([{ provide: 'token', useValue: 'value' }]);

    expect(injector.get('token')).to.equal('value');
  });

  it('should throw when given invalid providers', () => {
    expect(() => createInjector(['blah'] as any)).to.Throw(
      'Invalid provider - only instances of Provider and Type are allowed, got: blah',
    );
  });

  it('should provide itself', () => {
    const parent = createInjector([]);
    const child = parent.resolveAndCreateChild([]);

    expect(child.get(Injector)).to.equal(child);
  });

  it('should throw when no provider defined', () => {
    const injector = createInjector([]);
    expect(() => injector.get('NonExisting')).to.Throw('No provider for NonExisting!');
  });

  it('should show the full path when no provider', () => {
    const injector = createInjector([CarWithDashboard, Engine, Dashboard]);
    expect(() => injector.get(CarWithDashboard)).to.Throw(
      `No provider for DashboardSoftware! (${stringify(CarWithDashboard)} -> ${stringify(
        Dashboard,
      )} -> DashboardSoftware)`,
    );
  });

  it('should throw when trying to instantiate a cyclic dependency', () => {
    const injector = createInjector([Car, { provide: Engine, useClass: CyclicEngine }]);

    expect(() => injector.get(Car)).to.Throw(
      `Cannot instantiate cyclic dependency! (${stringify(Car)} -> ${stringify(
        Engine,
      )} -> ${stringify(Car)})`,
    );
  });

  it('should show the full path when error happens in a constructor', () => {
    const providers = ReflectiveInjector.resolve([
      Car,
      { provide: Engine, useClass: BrokenEngine },
    ]);
    const injector = new ReflectiveInjector_(providers);

    try {
      injector.get(Car);
      throw new Error('Must throw');
    } catch (e) {
      expect(e.message).to.contains(
        `Error during instantiation of Engine! (${stringify(Car)} -> Engine)`,
      );
      expect(getOriginalError(e) instanceof Error).to.be.true;
      expect(e.keys[0].token).to.equal(Engine);
    }
  });

  it('should support null values', () => {
    const injector = createInjector([{ provide: 'null', useValue: null }]);
    expect(injector.get('null')).to.equal(null);
  });
});

describe('child', () => {
  it('should load instances from parent injector', () => {
    const parent = ReflectiveInjector.resolveAndCreate([Engine]);
    const child = parent.resolveAndCreateChild([]);

    const engineFromParent = parent.get(Engine);
    const engineFromChild = child.get(Engine);

    expect(engineFromChild).to.equal(engineFromParent);
  });

  it('should not use the child providers when resolving the dependencies of a parent provider', () => {
    const parent = ReflectiveInjector.resolveAndCreate([Car, Engine]);
    const child = parent.resolveAndCreateChild([{ provide: Engine, useClass: TurboEngine }]);

    const carFromChild = child.get(Car);
    expect(carFromChild.engine instanceof Engine).to.be.true;
  });

  it('should create new instance in a child injector', () => {
    const parent = ReflectiveInjector.resolveAndCreate([Engine]);
    const child = parent.resolveAndCreateChild([{ provide: Engine, useClass: TurboEngine }]);

    const engineFromParent = parent.get(Engine);
    const engineFromChild = child.get(Engine);

    expect(engineFromParent).not.to.equal(engineFromChild);
    expect(engineFromChild instanceof TurboEngine).to.be.true;
  });

  it('should give access to parent', () => {
    const parent = ReflectiveInjector.resolveAndCreate([]);
    const child = parent.resolveAndCreateChild([]);
    expect(child.parent).to.equal(parent);
  });
});

describe('resolveAndInstantiate', () => {
  it('should instantiate an object in the context of the injector', () => {
    const inj = ReflectiveInjector.resolveAndCreate([Engine]);
    const car = inj.resolveAndInstantiate(Car);
    expect(car instanceof Car).to.be.true;
    expect(car.engine).to.equal(inj.get(Engine));
  });

  it('should not store the instantiated object in the injector', () => {
    const inj = ReflectiveInjector.resolveAndCreate([Engine]);
    inj.resolveAndInstantiate(Car);
    expect(() => inj.get(Car)).to.Throw();
  });
});

describe('instantiate', () => {
  it('should instantiate an object in the context of the injector', () => {
    const inj = ReflectiveInjector.resolveAndCreate([Engine]);
    const car = inj.instantiateResolved(ReflectiveInjector.resolve([Car])[0]);
    expect(car instanceof Car).to.be.true;
    expect(car.engine).to.equal(inj.get(Engine));
  });
});

describe('depedency resolution', () => {
  describe('@Self()', () => {
    it('should return a dependency from self', () => {
      const inj = ReflectiveInjector.resolveAndCreate([
        Engine,
        { provide: Car, useFactory: (e: Engine) => new Car(e), deps: [[Engine, new Self()]] },
      ]);

      expect(inj.get(Car) instanceof Car).to.be.true;
    });

    it('should throw when not requested provider on self', () => {
      const parent = ReflectiveInjector.resolveAndCreate([Engine]);
      const child = parent.resolveAndCreateChild([
        { provide: Car, useFactory: (e: Engine) => new Car(e), deps: [[Engine, new Self()]] },
      ]);

      expect(() => child.get(Car)).to.Throw(
        `No provider for Engine! (${stringify(Car)} -> ${stringify(Engine)})`,
      );
    });
  });

  describe('default', () => {
    it('should not skip self', () => {
      const parent = ReflectiveInjector.resolveAndCreate([Engine]);
      const child = parent.resolveAndCreateChild([
        { provide: Engine, useClass: TurboEngine },
        { provide: Car, useFactory: (e: Engine) => new Car(e), deps: [Engine] },
      ]);

      expect(child.get(Car).engine instanceof TurboEngine).to.be.true;
    });
  });
});

describe('resolve', () => {
  it('should resolve and flatten', () => {
    const providers = ReflectiveInjector.resolve([Engine, [BrokenEngine]]);
    providers.forEach(b => {
      if (!b) return; // the result is a sparse array
      expect(b instanceof ResolvedReflectiveProvider_).to.equal(true);
    });
  });

  it('should support multi providers', () => {
    const provider = ReflectiveInjector.resolve([
      { provide: Engine, useClass: BrokenEngine, multi: true },
      { provide: Engine, useClass: TurboEngine, multi: true },
    ])[0];

    expect(provider.key.token).to.equal(Engine);
    expect(provider.multiProvider).to.equal(true);
    expect(provider.resolvedFactories.length).to.equal(2);
  });

  it('should support providers as hash', () => {
    const provider = ReflectiveInjector.resolve([
      { provide: Engine, useClass: BrokenEngine, multi: true },
      { provide: Engine, useClass: TurboEngine, multi: true },
    ])[0];

    expect(provider.key.token).to.equal(Engine);
    expect(provider.multiProvider).to.equal(true);
    expect(provider.resolvedFactories.length).to.equal(2);
  });

  it('should support multi providers with only one provider', () => {
    const provider = ReflectiveInjector.resolve([
      { provide: Engine, useClass: BrokenEngine, multi: true },
    ])[0];

    expect(provider.key.token).to.equal(Engine);
    expect(provider.multiProvider).to.equal(true);
    expect(provider.resolvedFactories.length).to.equal(1);
  });

  it('should throw when mixing multi providers with regular providers', () => {
    expect(() => {
      ReflectiveInjector.resolve([
        { provide: Engine, useClass: BrokenEngine, multi: true },
        Engine,
      ]);
    }).to.Throw(/Cannot mix multi providers and regular providers/);

    expect(() => {
      ReflectiveInjector.resolve([
        Engine,
        { provide: Engine, useClass: BrokenEngine, multi: true },
      ]);
    }).to.Throw(/Cannot mix multi providers and regular providers/);
  });

  it('should resolve forward references', () => {
    const providers = ReflectiveInjector.resolve([
      forwardRef(() => Engine),
      [{ provide: forwardRef(() => BrokenEngine), useClass: forwardRef(() => Engine) }],
      {
        provide: forwardRef(() => String),
        useFactory: () => 'OK',
        deps: [forwardRef(() => Engine)],
      },
    ]);

    const engineProvider = providers[0];
    const brokenEngineProvider = providers[1];
    const stringProvider = providers[2];

    expect(engineProvider.resolvedFactories[0].factory() instanceof Engine).to.equal(true);
    expect(brokenEngineProvider.resolvedFactories[0].factory() instanceof Engine).to.equal(true);
    expect(stringProvider.resolvedFactories[0].dependencies[0].key).to.equal(
      ReflectiveKey.get(Engine),
    );
  });

  it('should support overriding factory dependencies with dependency annotations', () => {
    const providers = ReflectiveInjector.resolve([
      {
        provide: 'token',
        useFactory: (e: any /** TODO #9100 */) => 'result',
        deps: [[new Inject('dep')]],
      },
    ]);

    const provider = providers[0];

    expect(provider.resolvedFactories[0].dependencies[0].key.token).to.equal('dep');
  });

  it('should allow declaring dependencies with flat arrays', () => {
    const resolved = ReflectiveInjector.resolve([
      { provide: 'token', useFactory: (e: any) => e, deps: [new Inject('dep')] },
    ]);
    const nestedResolved = ReflectiveInjector.resolve([
      { provide: 'token', useFactory: (e: any) => e, deps: [[new Inject('dep')]] },
    ]);
    expect(resolved[0].resolvedFactories[0].dependencies[0].key.token).to.equal(
      nestedResolved[0].resolvedFactories[0].dependencies[0].key.token,
    );
  });
});

describe('displayName', () => {
  it('should work', () => {
    expect(
      (ReflectiveInjector.resolveAndCreate([Engine, BrokenEngine]) as ReflectiveInjector_)
        .displayName,
    ).to.equal('ReflectiveInjector(providers: [ "Engine" ,  "BrokenEngine" ])');
  });
});