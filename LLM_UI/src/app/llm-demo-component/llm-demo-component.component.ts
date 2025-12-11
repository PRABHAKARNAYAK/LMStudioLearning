import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { LlmService } from '../services/llm.service';

@Component({
  // selector: 'app-llm-demo',
  selector: 'app-llm-demo-component',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './llm-demo-component.component.html',
  styleUrl: './llm-demo-component.component.scss',
})
export class LlmDemoComponentComponent {
  private readonly llm = inject(LlmService);

  question =
    'For Lexium38i, what are typical causes of alarm E123 and which section covers it?';
  answer = '';
  debug: any = null;
  error = '';
  loading = false;

  ask() {
    this.error = '';
    this.answer = '';
    this.debug = null;
    this.loading = true;

    this.llm.chatWithTools(this.question).subscribe({
      next: (res) => {
        this.answer = res.answer ?? '';
        this.debug = res.debug ?? null;
        this.loading = false;
      },
      error: (e) => {
        this.error = e?.message || 'An error occurred.';
        this.loading = false;
      },
    });
  }
}
