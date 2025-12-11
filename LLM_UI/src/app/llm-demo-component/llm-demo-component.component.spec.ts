import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LlmDemoComponentComponent } from './llm-demo-component.component';

describe('LlmDemoComponentComponent', () => {
  let component: LlmDemoComponentComponent;
  let fixture: ComponentFixture<LlmDemoComponentComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LlmDemoComponentComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LlmDemoComponentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
