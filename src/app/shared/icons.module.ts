import { NgModule } from '@angular/core';
import {
  AlertTriangle,
  ChevronRight,
  LogOut,
  LucideAngularModule,
  Settings,
  Shield,
  Trash2,
  UserMinus,
  UserPlus,
  Users,
} from 'lucide-angular';
import {
  MessageCircle,
  MessageSquare,
  Send,
  Search,
  X,
  AlertCircle,
  WifiOff,
  Phone,
  Video,
  MoreVertical,
  Plus,
  Clock,
  Check,
  CheckCheck,
  ChevronLeft,
} from 'lucide-angular';

@NgModule({
  imports: [
    LucideAngularModule.pick({
      MessageCircle,
      MessageSquare,
      Send,
      Search,
      X,
      AlertCircle,
      WifiOff,
      Phone,
      Video,
      MoreVertical,
      Plus,
      Clock,
      Check,
      CheckCheck,
      ChevronLeft,
      Users,
      Shield,
      UserMinus,
      UserPlus,
      Settings,
      LogOut,
      Trash2,
      ChevronRight,
      AlertTriangle,
    }),
  ],
  exports: [
    LucideAngularModule, // 👈 important so other modules can use icons
  ],
})
export class IconsModule {}
