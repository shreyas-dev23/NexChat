import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SharedComponent } from './shared.component';
import { DialogComponent } from './components/dialog/dialog.component';
import { IconsModule } from './icons.module';
import { FormsModule } from '@angular/forms';

@NgModule({
  imports: [CommonModule, IconsModule, FormsModule],
  declarations: [SharedComponent, DialogComponent],
  exports: [DialogComponent],
})
export class SharedModule {}
