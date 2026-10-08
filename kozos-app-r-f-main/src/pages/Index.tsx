import { useEffect, useMemo, useRef, useState } from "react";
import { onValue, push, ref, remove, set } from "firebase/database";
import type { LucideIcon } from "lucide-react";
import {
  Award,
  CalendarDays,
  CarFront,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock3,
  CreditCard,
  Filter,
  Home,
  LogIn,
  LogOut,
  Menu,
  Pencil,
  PiggyBank,
  Plus,
  ReceiptText,
  Repeat2,
  Trash2,
  Search,
  Settings2,
  Sparkles,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { VehiclesView, type Vehicle, type VehicleFormData } from "@/components/VehiclesView";
import { realtimeDb } from "@/lib/firebase";
import { cn } from "@/lib/utils";

type View =
  | "home"
  | "tasks"
  | "bills"
  | "calendar"
  | "payments"
  | "budget"
  | "vehicles"
  | "leaderboard"
  | "settings";
type Priority = "Magas" | "Közepes" | "Alacsony";
type UserRole = "admin" | "user";
type FamilyMember = {
  name: string;
  initials: string;
  symbol: string;
  tone: string;
  role: UserRole;
};

const CURRENT_DATE = "2026-09-29";
const defaultFamilyMembers: FamilyMember[] = [
  { name: "Elod", initials: "EL", symbol: "🐺", tone: "bg-[#f7a78f] text-[#803c32]", role: "admin" },
  { name: "Laura", initials: "LA", symbol: "🦅", tone: "bg-[#83c9b9] text-[#225f55]", role: "user" },
  { name: "Mama", initials: "MA", symbol: "🦉", tone: "bg-[#a9b7ee] text-[#39468b]", role: "user" },
  { name: "Zselyke", initials: "ZS", symbol: "🐆", tone: "bg-[#f5c77e] text-[#79551d]", role: "user" },
  { name: "Zengo", initials: "ZE", symbol: "🐉", tone: "bg-[#c59de8] text-[#5c3478]", role: "user" },
  { name: "Zete", initials: "ZT", symbol: "🐎", tone: "bg-[#8fc5ee] text-[#214c75]", role: "user" },
];
let familyMembers: FamilyMember[] = [...defaultFamilyMembers];

      type Task = {
  id: number;
  title: string;
  category: string;
  due: string;
  time?: string;
  assignee: string;
  initials: string;
  color: string;
  priority: Priority;
  done: boolean;
  createdBy?: string;
  completedBy?: string;
  completedAt?: string;
  recurring?: boolean;
};

type Bill = {
  id: number;
  name: string;
  amount: string;
  due: string;
  type: string;
  paid: boolean;
  createdBy?: string;
  paidBy?: string;
  paidAt?: string;
  icon: LucideIcon;
  tone: string;
};
type BudgetSource = {
  id: string;
  amount: string;
  source: string;
  date: string;
  createdAt: number;
};
const initialTasks: Task[] = [];
const initialBills: Bill[] = [];

const navItems: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "home", label: "Áttekintés", icon: Home },
  { id: "tasks", label: "Feladatok", icon: ClipboardList },
  { id: "bills", label: "Számlák", icon: CreditCard },
  { id: "payments", label: "Kifizetések", icon: ReceiptText },
  { id: "budget", label: "Költségvetés", icon: PiggyBank },
  { id: "vehicles", label: "Autók", icon: CarFront },
  { id: "calendar", label: "Naptár", icon: CalendarDays },
  { id: "leaderboard", label: "Legszorgalmasabb", icon: Award },
];

const mobileNavItems: { id: View; label: string; icon: LucideIcon }[] = [
  ...navItems,
  { id: "settings", label: "Beállítások", icon: Settings2 },
];

const monthlyCompletion: { name: string; symbol: string; completed: number; tone: string }[] = [];

const priorityStyle: Record<Priority, string> = {
  Magas: "bg-[#fff0eb] text-[#db6e55]",
  Közepes: "bg-[#fff8df] text-[#b98b29]",
  Alacsony: "bg-[#e8f5ef] text-[#398c76]",
};

const avatarStyle: Record<string, string> = {
  EL: "bg-[#f7a78f] text-[#803c32]",
  LA: "bg-[#83c9b9] text-[#225f55]",
  MA: "bg-[#a9b7ee] text-[#39468b]",
  ZS: "bg-[#f5c77e] text-[#79551d]",
  ZE: "bg-[#c59de8] text-[#5c3478]",
  ZT: "bg-[#8fc5ee] text-[#214c75]",
};

function formatDate(date?: string) {
  if (!date) return "";
  const [year, month, day] = date.split("-");
  return year && month && day ? `${day}.${month}.${year}.` : date;
}

function memberNameForInitials(initials: string) {
  return familyMembers.find((member) => member.initials === initials)?.name || initials;
}

function memberSymbolForInitials(initials: string) {
  return familyMembers.find((member) => member.initials === initials)?.symbol || "•";
}

function memberSymbolForName(name: string) {
  return familyMembers.find((member) => member.name === name)?.symbol || "•";
}

function vehicleOwnerKey(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

function familyMemberKey(name: string) {
  return name.trim().toLowerCase().replace(/[^a-z0-9_-]/g, "_");
}

function initialsFromName(name: string) {
  return name.trim().split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
}

function formatLei(amount: string) {
  const normalized = amount.trim().replace(/\s*(lej|lei)$/i, "").trim();
  return normalized ? `${normalized} lej` : "";
}

function amountValue(amount: string) {
  const normalized = amount.replace(/\s*(lej|lei)$/i, "").replace(/\s/g, "").replace(",", ".");
  const value = Number(normalized);
  return Number.isFinite(value) ? value : 0;
}

function formatLeiTotal(amount: number) {
  return `${new Intl.NumberFormat("hu-HU").format(amount)} lej`;
}

function AppLogo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className={cn(
          "relative flex items-center justify-center rounded-[14px] bg-[#6d5ef5] shadow-[0_7px_18px_rgba(109,94,245,0.24)]",
          small ? "h-9 w-9" : "h-11 w-11"
        )}
      >
        <div className="absolute h-5 w-5 rounded-full border-[3px] border-[#ffe7a8]" />
        <div className="absolute left-[9px] top-[20px] h-[3px] w-3 rotate-45 rounded-full bg-[#ffe7a8]" />
        <div className="absolute left-[17px] top-[17px] h-[3px] w-2.5 -rotate-45 rounded-full bg-[#ffe7a8]" />
        <Sparkles className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-[#ffd86e] text-[#ffd86e]" />
      </div>
      {!small && (
        <span className="text-[18px] font-extrabold tracking-[-0.04em] text-[#f3f0ff]">
          Közös<span className="text-[#6d5ef5]">Nap</span>
        </span>
      )}
    </div>
  );
}

function TaskRow({
  task,
  onToggle,
  onEdit,
  onDelete,
  canEdit,
  canDelete,
}: {
  task: Task;
  onToggle: (id: number) => void;
  onEdit: (task: Task) => void;
  onDelete: (id: number) => void;
  canEdit: boolean;
  canDelete: boolean;
}) {
  return (
    <div
      className={cn(
        "group flex items-center gap-3 rounded-[18px] border border-[#252525] bg-[#111111] px-3.5 py-3 transition hover:border-[#d9d1f9] hover:shadow-[0_8px_25px_rgba(69,58,135,0.06)]",
        task.done && "bg-[#171717]"
      )}
    >
      <Checkbox
        checked={task.done}
        disabled={!canEdit}
        onCheckedChange={() => onToggle(task.id)}
        className="h-[21px] w-[21px] rounded-full border-[#686868] data-[state=checked]:border-[#6d5ef5] data-[state=checked]:bg-[#6d5ef5]"
      />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p
            className={cn(
              "truncate text-[14px] font-bold text-[#f3f0ff]",
              task.done && "text-[#aaa6bb] line-through"
            )}
          >
            Feladat: {task.title} : {task.createdBy || task.assignee}
          </p>
          {task.recurring && <Repeat2 className="h-3.5 w-3.5 shrink-0 text-[#998de4]" />}
        </div>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] font-medium text-[#aaa6b8]">
          <span className="flex items-center gap-1">
            <Clock3 className="h-3.5 w-3.5" />
            {task.due}
            {task.time && ` · ${task.time}`}
          </span>
          <span className="h-1 w-1 rounded-full bg-[#d9d5e3]" />
          <span>{task.category}</span>
          {task.done && task.completedBy && (
            <>
              <span className="h-1 w-1 rounded-full bg-[#d9d5e3]" />
              <span>
                Teljesítette: {task.completedBy}
                {task.completedAt && ` · ${formatDate(task.completedAt)}`}
              </span>
            </>
          )}
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <span
          className={cn(
            "hidden rounded-full px-2 py-1 text-[10px] font-bold sm:inline-flex",
            priorityStyle[task.priority]
          )}
        >
          {task.priority}
        </span>
        <div
          className={cn(
            "flex h-8 w-8 items-center justify-center rounded-full text-[16px]",
            avatarStyle[task.initials] || "bg-[#eeeafd] text-[#6d5ef5]"
          )}
          title={task.assignee}
        >
          {memberSymbolForInitials(task.initials)}
        </div>
        {canEdit && (
          <button
            onClick={() => onEdit(task)}
            aria-label={`${task.title} módosítása`}
            title="Feladat módosítása"
            className="flex h-8 items-center gap-1 rounded-[9px] border border-[#383838] px-2 text-[10px] font-bold text-[#aaa6b8] transition hover:border-[#6d5ef5] hover:text-[#a69dff]"
          >
            <Pencil className="h-3.5 w-3.5" />
            <span>Módosít</span>
          </button>
        )}
        {canDelete && (
          <button
            onClick={() => onDelete(task.id)}
            aria-label={`${task.title} törlése`}
            title="Feladat törlése"
            className="flex h-8 items-center gap-1 rounded-[9px] border border-[#583333] px-2 text-[10px] font-bold text-[#e48868] transition hover:border-[#e05d5d] hover:text-[#ff9b86]"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>Töröl</span>
          </button>
        )}
      </div>
    </div>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  count,
  action,
  onAction,
}: {
  icon: LucideIcon;
  title: string;
  count?: number;
  action?: string;
  onAction?: () => void;
}) {
  return (
    <div className="mb-3 flex items-center justify-between">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#f0edff] text-[#6d5ef5]">
          <Icon className="h-4 w-4" />
        </div>
        <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#f3f0ff]">{title}</h2>
        {count !== undefined && (
          <span className="rounded-full bg-[#26232f] px-2 py-0.5 text-[11px] font-bold text-[#aaa6b8]">
            {count}
          </span>
        )}
      </div>
      {action && (
        <button
          onClick={onAction}
          className="text-[12px] font-bold text-[#6d5ef5] transition hover:text-[#4f42c6]"
        >
          {action}
        </button>
      )}
    </div>
  );
}

function NewTaskDialog({
  onAdd,
  currentUser,
}: {
  onAdd: (task: Task) => void;
  currentUser: string;
}) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Otthon");
  const [priority, setPriority] = useState<Priority>("Közepes");
  const [assignee, setAssignee] = useState("EL");

  const submit = () => {
    if (!title.trim()) return;
    onAdd({
      id: Date.now(),
      title: title.trim(),
      category,
      due: "Ma",
      time: "",
      assignee: memberNameForInitials(assignee),
      initials: assignee,
      color: "bg-[#f7a78f]",
      priority,
      done: false,
      createdBy: currentUser || undefined,
    });
    setTitle("");
    setOpen(false);
    toast.success("Új feladat hozzáadva", { description: "A családi listában már látható is." });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="h-11 rounded-[14px] bg-[#6d5ef5] px-4 text-[13px] font-bold text-white shadow-[0_8px_18px_rgba(109,94,245,0.22)] hover:bg-[#5d4fe1]">
          <Plus className="mr-1.5 h-4 w-4" />
          Új feladat
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-24px)] max-w-[430px] rounded-[26px] border-[#ede9f6] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#f3f0ff]">Új feladat</DialogTitle>
          <DialogDescription className="text-[#aaa6b8]">
            Osszátok meg a teendőket egyszerűen.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Mi a feladat?</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submit()}
              placeholder="pl. Vacsora elkészítése"
              className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Kategória</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="h-11 w-full rounded-[13px] border border-[#303030] bg-[#171717] px-3 text-sm text-[#f3f0ff] outline-none"
              >
                <option>Otthon</option>
                <option>Család</option>
                <option>Bevásárlás</option>
                <option>Egészség</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Prioritás</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as Priority)}
                className="h-11 w-full rounded-[13px] border border-[#303030] bg-[#171717] px-3 text-sm text-[#f3f0ff] outline-none"
              >
                <option>Magas</option>
                <option>Közepes</option>
                <option>Alacsony</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Kihez tartozik?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {familyMembers.map((member) => (
                <button
                  key={member.initials}
                  onClick={() => setAssignee(member.initials)}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center gap-1.5 rounded-[12px] border text-xs font-bold transition",
                    assignee === member.initials
                      ? "border-[#6d5ef5] bg-[#f0edff] text-[#6d5ef5]"
                      : "border-[#303030] text-[#aaa6b8]"
                  )}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
          <Button onClick={submit} className="h-11 w-full rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]">
            Feladat létrehozása
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function NewBillDialog({
  onAdd,
  currentUser,
}: {
  onAdd: (bill: Bill) => void;
  currentUser: string;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [type, setType] = useState("Háztartás");
  const submittingRef = useRef(false);

  const submit = () => {
    if (!name.trim() || !amount.trim() || !due.trim()) return;
    if (submittingRef.current) return;

  submittingRef.current = true;
    onAdd({
      id: Date.now(),
      name: name.trim(),
      amount: formatLei(amount),
      due: due.trim(),
      type,
      paid: false,
      createdBy: currentUser || undefined,
      icon: Home,
      tone: "bg-[#eeeafd] text-[#6d5ef5]",
    });
    setName("");
    setAmount("");
    setDue("");
    setOpen(false);
    submittingRef.current = false;
    toast.success("Új számla hozzáadva", {
      description: currentUser ? `Rögzítette: ${currentUser}` : "A számlák között már látható.",
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="h-10 rounded-[13px] border-[#383838] text-xs font-bold text-[#6d5ef5]">
          <Plus className="mr-1.5 h-4 w-4" />
          Új számla
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-24px)] max-w-[430px] rounded-[26px] border-[#303030] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#f3f0ff]">Új számla</DialogTitle>
          <DialogDescription className="text-[#aaa6b8]">
            Add meg a szolgáltató és a számla adatait.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Szolgáltató neve</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="pl. Digi"
              className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Összeg</label>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="pl. 250 lej"
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Esedékesség</label>
              <Input
                value={due}
                onChange={(event) => setDue(event.target.value)}
                placeholder="pl. 20.10."
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Kategória</label>
            <Input
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
            />
          </div>
          <Button onClick={submit} className="h-11 w-full rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]">
            Számla hozzáadása
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function BillRow({
  bill,
  onToggle,
  onEdit,
  onDelete,
  canManage,
}: {
  bill: Bill;
  onToggle: (id: number) => void;
  onEdit: (bill: Bill) => void;
  onDelete: (id: number) => void;
  canManage: boolean;
}) {
  const Icon = bill.icon;
  return (
    <div className={cn("flex items-center gap-3 rounded-[18px] border border-[#252525] bg-[#111111] p-3.5", bill.paid && "opacity-65")}>
      <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[13px]", bill.tone)}>
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-extrabold text-[#f3f0ff]", bill.paid && "line-through text-[#aaa6bb]")}>
          Számla: {bill.name} : {bill.paidBy || bill.createdBy || "Nincs megadva"}
        </p>
        <p className="mt-0.5 text-[11px] font-medium text-[#aaa6b8]">
          {bill.type} · Esedékes {bill.due}
        </p>
        {bill.paid && bill.paidBy && (
          <p className="mt-1 text-[10px] font-semibold text-[#47a386]">
            Fizette: {bill.paidBy}
            {bill.paidAt && ` · ${formatDate(bill.paidAt)}`}
          </p>
        )}
      </div>
      <div className="text-right">
        <p className="text-[13px] font-extrabold text-[#f3f0ff]">{bill.amount}</p>
        {canManage && (
          <div className="mt-1 flex items-center justify-end gap-2">
            <button
              onClick={() => onToggle(bill.id)}
              className={cn("text-[10px] font-bold", bill.paid ? "text-[#47a386]" : "text-[#e48868]")}
            >
              {bill.paid ? "Kifizetve" : "Megjelölöm"}
            </button>
            <button
              onClick={() => onEdit(bill)}
              aria-label={`${bill.name} módosítása`}
              title="Számla módosítása"
              className="flex h-7 items-center gap-1 rounded-[8px] border border-[#383838] px-2 text-[10px] font-bold text-[#aaa6b8] transition hover:border-[#6d5ef5] hover:text-[#a69dff]"
            >
              <Pencil className="h-3 w-3" />
              <span>Módosít</span>
            </button>
            <button
              onClick={() => onDelete(bill.id)}
              aria-label={`${bill.name} törlése`}
              title="Számla törlése"
              className="flex h-7 items-center gap-1 rounded-[8px] border border-[#583333] px-2 text-[10px] font-bold text-[#e48868] transition hover:border-[#e05d5d] hover:text-[#ff9b86]"
            >
              <Trash2 className="h-3 w-3" />
              <span>Töröl</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function EditTaskDialog({
  task,
  onClose,
  onSave,
}: {
  task: Task | null;
  onClose: () => void;
  onSave: (task: Task) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Otthon");
  const [priority, setPriority] = useState<Priority>("Közepes");
  const [assignee, setAssignee] = useState("EL");
  const [done, setDone] = useState(false);
  const [completedBy, setCompletedBy] = useState("");
  const [completedAt, setCompletedAt] = useState("");

  useEffect(() => {
    if (!task) return;
    setTitle(task.title);
    setCategory(task.category);
    setPriority(task.priority);
    setAssignee(task.initials);
    setDone(task.done);
    setCompletedBy(task.completedBy || "");
    setCompletedAt(task.completedAt || "");
  }, [task]);

  if (!task) return null;
  const save = () => {
    if (!title.trim()) return;
    onSave({
      ...task,
      title: title.trim(),
      category,
      priority,
      assignee: memberNameForInitials(assignee),
      initials: assignee,
      done,
      completedBy: completedBy.trim(),
      completedAt,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-24px)] max-w-[430px] rounded-[26px] border-[#303030] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#f3f0ff]">
            Feladat módosítása
          </DialogTitle>
          <DialogDescription className="text-[#aaa6b8]">
            Javítsd a feladat adatait, majd mentsd el.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Mi a feladat?</label>
            <Input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Kategória</label>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="h-11 w-full rounded-[13px] border border-[#303030] bg-[#171717] px-3 text-sm text-[#f3f0ff] outline-none"
              >
                <option>Otthon</option>
                <option>Család</option>
                <option>Bevásárlás</option>
                <option>Egészség</option>
              </select>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Prioritás</label>
              <select
                value={priority}
                onChange={(event) => setPriority(event.target.value as Priority)}
                className="h-11 w-full rounded-[13px] border border-[#303030] bg-[#171717] px-3 text-sm text-[#f3f0ff] outline-none"
              >
                <option>Magas</option>
                <option>Közepes</option>
                <option>Alacsony</option>
              </select>
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Kihez tartozik?</label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {familyMembers.map((member) => (
                <button
                  key={member.initials}
                  onClick={() => setAssignee(member.initials)}
                  className={cn(
                    "flex h-10 flex-1 items-center justify-center rounded-[12px] border text-xs font-bold transition",
                    assignee === member.initials
                      ? "border-[#6d5ef5] bg-[#f0edff] text-[#6d5ef5]"
                      : "border-[#303030] text-[#aaa6b8]"
                  )}
                >
                  {member.name}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-3 rounded-[14px] border border-[#303030] bg-[#111111] p-3">
            <label className="flex items-center gap-2 text-xs font-bold text-[#c8c3d5]">
              <Checkbox checked={done} onCheckedChange={(checked) => setDone(checked === true)} />
              Teljesítve
            </label>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-[#aaa6b8]">
                  Ki teljesítette?
                </label>
                <Input
                  value={completedBy}
                  onChange={(event) => setCompletedBy(event.target.value)}
                  placeholder="pl. Elod"
                  className="h-10 rounded-[11px] border-[#303030] bg-[#171717]"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-[11px] font-bold text-[#aaa6b8]">
                  Teljesítés dátuma
                </label>
                <Input
                  type="date"
                  value={completedAt}
                  onChange={(event) => setCompletedAt(event.target.value)}
                  className="h-10 rounded-[11px] border-[#303030] bg-[#171717]"
                />
              </div>
            </div>
          </div>
          <Button onClick={save} className="h-11 w-full rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]">
            Módosítások mentése
          </Button>
        </div>
      </DialogContent>
    </Dialog>
   
  );
}

function EditBillDialog({
  bill,
  onClose,
  onSave,
}: {
  bill: Bill | null;
  onClose: () => void;
  onSave: (bill: Bill) => void;
}) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [due, setDue] = useState("");
  const [type, setType] = useState("");
  const [paidBy, setPaidBy] = useState("");
  const [paidAt, setPaidAt] = useState("");

  useEffect(() => {
    if (!bill) return;
    setName(bill.name);
    setAmount(bill.amount);
    setDue(bill.due);
    setType(bill.type);
    setPaidBy(bill.paidBy || "");
    setPaidAt(bill.paidAt || "");
  }, [bill]);

  if (!bill) return null;
  const save = () => {
    if (!name.trim() || !amount.trim() || !due.trim()) return;
    onSave({
      ...bill,
      name: name.trim(),
      amount: formatLei(amount),
      due: due.trim(),
      type: type.trim() || "Egyéb",
      paid: Boolean(paidBy.trim() && paidAt),
      paidBy: paidBy.trim(),
      paidAt,
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[calc(100%-24px)] max-w-[430px] rounded-[26px] border-[#303030] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#f3f0ff]">
            Számla módosítása
          </DialogTitle>
          <DialogDescription className="text-[#aaa6b8]">
            Írd át a szolgáltató nevét vagy a számla adatait.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Szolgáltató neve</label>
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              autoFocus
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Összeg</label>
              <Input
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
                placeholder="pl. 250 lej"
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Esedékesség</label>
              <Input
                value={due}
                onChange={(event) => setDue(event.target.value)}
                placeholder="pl. 20.05."
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              />
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Kategória</label>
            <Input
              value={type}
              onChange={(event) => setType(event.target.value)}
              className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">Ki fizette ki?</label>
              <Input
                value={paidBy}
                onChange={(event) => setPaidBy(event.target.value)}
                placeholder="pl. Laura"
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">
                Kifizetés dátuma
              </label>
              <Input
                type="date"
                value={paidAt}
                onChange={(event) => setPaidAt(event.target.value)}
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
              />
            </div>
          </div>
          <Button onClick={save} className="h-11 w-full rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]">
            Módosítások mentése
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function LoginDialog({
  userName,
  onLogin,
  onLogout,
}: {
  userName: string;
  onLogin: (name: string) => void;
  onLogout: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const loggedInMember = familyMembers.find((member) => member.name === userName);

  const submit = () => {
    const member = familyMembers.find(
      (item) => item.name.toLowerCase() === name.trim().toLowerCase()
    );
    if (!member) {
      toast.error("Ez a név nincs a családi listában.", {
        description: "Elod, Laura, Mama, Zselyke, Zengo vagy Zete névvel lehet belépni.",
      });
      return;
    }
    onLogin(member.name);
    setName("");
    setOpen(false);
    toast.success(`Bejelentkezve: ${member.name}`);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          className="h-10 rounded-[13px] px-3 text-xs font-bold text-[#aaa6b8] hover:bg-[#111111] hover:text-[#f3f0ff]"
        >
          <LogIn className="mr-1.5 h-4 w-4" />
          {userName ? userName : "Bejelentkezés"}
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100%-24px)] max-w-[380px] rounded-[26px] border-[#303030] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#f3f0ff]">
            {userName ? "Felhasználói fiók" : "Bejelentkezés"}
          </DialogTitle>
          <DialogDescription className="text-[#aaa6b8]">
            {userName
              ? "A neved megjelenik a feladatoknál és a számláknál."
              : "Csak a következő családtagnevekkel lehet belépni: Elod, Laura, Mama, Zselyke, Zengo vagy Zete."}
          </DialogDescription>
        </DialogHeader>
        {userName ? (
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-3 rounded-[14px] border border-[#303030] bg-[#171717] p-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#f7a78f] text-xs font-extrabold text-[#803c32]">
                {memberSymbolForName(userName)}
              </div>
              <div>
                <p className="text-sm font-extrabold text-[#f3f0ff]">{userName}</p>
                <p className="text-xs text-[#aaa6b8]">
                  {loggedInMember?.role === "admin"
                    ? "Adminisztrátor · mindenhez hozzáfér"
                    : "Sima felhasználó · csak feladatokat módosíthat"}
                </p>
              </div>
            </div>
            <Button
              onClick={() => {
                onLogout();
                setOpen(false);
                toast.success("Kijelentkeztél.");
              }}
              variant="outline"
              className="h-11 w-full rounded-[13px] border-[#583333] font-bold text-[#e48868]"
            >
              <LogOut className="mr-1.5 h-4 w-4" />
              Kijelentkezés
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-2">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">
                Felhasználónév
              </label>
              <Input
                value={name}
                onChange={(event) => setName(event.target.value)}
                onKeyDown={(event) => event.key === "Enter" && submit()}
                placeholder="pl. Elod"
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717]"
                autoFocus
              />
            </div>
            <Button onClick={submit} className="h-11 w-full rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]">
              <LogIn className="mr-1.5 h-4 w-4" />
              Belépés
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function Index() {
  const [view, setView] = useState<View>("home");
  const [tasks, setTasks] = useState<Task[]>(initialTasks);
  const [bills, setBills] = useState<Bill[]>(initialBills);
  useEffect(() => {
  const tasksRef = ref(realtimeDb, "tasks");

  return onValue(
    tasksRef,
    (snapshot) => {
      const stored = snapshot.val() as Record<string, Task> | null;
      const loaded = stored ? Object.values(stored) : [];
      setTasks(loaded);
    },
    () => toast.error("A feladatok betöltése nem sikerült.")
  );
}, []);
useEffect(() => {
  const billsRef = ref(realtimeDb, "bills");
  useEffect(() => {
  const budgetSourcesRef = ref(realtimeDb, "budgetSources");

  return onValue(
    budgetSourcesRef,
    (snapshot) => {
      const stored = snapshot.val() as Record<string, BudgetSource> | null;
      const loaded = stored ? Object.values(stored) : [];

      setBudgetSources(
        loaded.sort((a, b) => b.createdAt - a.createdAt)
      );
    },
    (error) => {
      console.error("Költségvetési források betöltési hiba:", error);
      toast.error("A költségvetési források betöltése nem sikerült.");
    }
  );
}, []);

  return onValue(
    billsRef,
    (snapshot) => {
      const stored = snapshot.val();

      if (!stored) {
        setBills([]);
        return;
      }

      const loaded = Object.entries(stored).map(
        ([firebaseId, bill]) => ({
          ...(bill as Omit<Bill, "icon">),
          id: Number(firebaseId),
          icon: Home,
        })
      );

      setBills(loaded);
    },
    (error) => {
      console.error("Bills betöltési hiba:", error);
      toast.error("A számlák betöltése nem sikerült.");
    }
  );
}, []);
  const [filter, setFilter] = useState("Mind");
  const [search, setSearch] = useState("");
  const [userName, setUserName] = useState(
  () => localStorage.getItem("kozosapp_user") || ""
);
  const [members, setMembers] = useState<FamilyMember[]>(familyMembers);
  
  const [budgetSources, setBudgetSources] = useState<BudgetSource[]>([]);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [editingBill, setEditingBill] = useState<Bill | null>(null);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [vehiclesLoading, setVehiclesLoading] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const currentMember = members.find((member) => member.name === userName);
  const isAdmin = currentMember?.role === "admin";
  const canModifyTasks = Boolean(currentMember);
  const canDeleteTasks = isAdmin;

  useEffect(() => {
    const membersRef = ref(realtimeDb, "familyMembers");
    return onValue(
      membersRef,
      (snapshot) => {
        const stored = snapshot.val() as Record<string, FamilyMember> | null;
        const loaded = stored ? Object.values(stored) : defaultFamilyMembers;
        familyMembers = loaded;
        setMembers(loaded);
      },
      () => toast.error("A felhasználói lista betöltése nem sikerült.")
    );
  }, []);

  const saveMembers = async (nextMembers: FamilyMember[]) => {
    const membersData = Object.fromEntries(nextMembers.map((member) => [familyMemberKey(member.name), member]));
    await set(ref(realtimeDb, "familyMembers"), membersData);
    familyMembers = nextMembers;
    setMembers(nextMembers);
  };

  const addMember = async (name: string) => {
    if (!isAdmin) throw new Error("Nincs adminisztrátori jogosultság.");
    const trimmedName = name.trim();
    if (!trimmedName) throw new Error("A név kötelező.");
    if (members.some((member) => member.name.toLowerCase() === trimmedName.toLowerCase())) throw new Error("Ez a felhasználó már létezik.");
    const newMember: FamilyMember = { name: trimmedName, initials: initialsFromName(trimmedName), symbol: "👤", tone: "bg-[#d8c7f2] text-[#5c3478]", role: "user" };
    await saveMembers([...members, newMember]);
  };

  const removeMember = async (name: string) => {
    if (!isAdmin || name === "Elod") throw new Error("Ezt a felhasználót nem lehet eltávolítani.");
    await saveMembers(members.filter((member) => member.name !== name));
  };

  useEffect(() => {
    if (!userName) {
      setVehicles([]);
      setVehiclesLoading(false);
      return;
    }
    const vehiclesRef = ref(realtimeDb, "vehicles");
setVehiclesLoading(true);

return onValue(
  vehiclesRef,
  (snapshot) => {
    const stored = (snapshot.val() || {}) as Record<
      string,
      Record<string, Partial<Vehicle>>
    >;

    const loaded = Object.entries(stored).flatMap(
      ([ownerKey, ownerVehicles]) =>
        Object.entries(ownerVehicles || {}).map(([id, vehicle]) => ({
          id,
          ownerKey: vehicle.ownerKey || ownerKey,
          ownerName: vehicle.ownerName || ownerKey,
          makeModel: vehicle.makeModel || "",
          licensePlate: vehicle.licensePlate || "",
          currentMileage: vehicle.currentMileage || 0,
          oilChangeIntervalKm: vehicle.oilChangeIntervalKm ?? null,
          nextOilChangeKm: vehicle.nextOilChangeKm ?? null,
          timingBeltKm: vehicle.timingBeltKm ?? null,
          brakeService: vehicle.brakeService || "",
          technicalInspectionDate: vehicle.technicalInspectionDate || "",
          insuranceExpiryDate: vehicle.insuranceExpiryDate || "",
          maintenanceNotes: vehicle.maintenanceNotes || "",
          createdAt: vehicle.createdAt || 0,
          updatedAt: vehicle.updatedAt || 0,
        }))
    );

    setVehicles(loaded);
    setVehiclesLoading(false);
  },
  () => {
    setVehiclesLoading(false);
    toast.error("A járművek betöltése nem sikerült.");
  }
);}, []);
  const addVehicle = async (data: VehicleFormData) => {
    if (!userName) throw new Error("Nincs bejelentkezett felhasználó.");
    const ownerKey = vehicleOwnerKey(userName);
    const vehicleRef = push(ref(realtimeDb, `vehicles/${ownerKey}`));
    const now = Date.now();
    const storedVehicle = { ...data, ownerKey, ownerName: userName, createdAt: now, updatedAt: now };
    await set(vehicleRef, storedVehicle);
    if (vehicleRef.key) setVehicles((current) => [...current, { id: vehicleRef.key!, ...storedVehicle }]);
  };

  const updateVehicle = async (id: string, data: VehicleFormData) => {
    if (!userName) throw new Error("Nincs bejelentkezett felhasználó.");
    const ownerKey = vehicleOwnerKey(userName);
    const existing = vehicles.find((vehicle) => vehicle.id === id);
    const storedVehicle = { ...data, ownerKey, ownerName: userName, createdAt: existing?.createdAt || Date.now(), updatedAt: Date.now() };
    await set(ref(realtimeDb, `vehicles/${ownerKey}/${id}`), storedVehicle);
    setVehicles((current) => current.map((vehicle) => vehicle.id === id ? { id, ...storedVehicle } : vehicle));
  };

  const deleteVehicle = async (id: string) => {
    if (!userName) throw new Error("Nincs bejelentkezett felhasználó.");
    const ownerKey = vehicleOwnerKey(userName);
    await remove(ref(realtimeDb, `vehicles/${ownerKey}/${id}`));
    setVehicles((current) => current.filter((vehicle) => vehicle.id !== id));
    toast.success("A jármű törölve.");
  };

  const toggleTask = async (id: number) => {
  if (!canModifyTasks) return;

  const currentTask = tasks.find((task) => task.id === id);
  if (!currentTask) return;

  const done = !currentTask.done;

  const updatedTask = {
    ...currentTask,
    done,
    completedBy: done
      ? userName || currentTask.completedBy || currentTask.assignee
      : "",
    completedAt: done ? CURRENT_DATE : "",
  };

  try {
    await set(ref(realtimeDb, `tasks/${id}`), updatedTask);

    setTasks((current) =>
      current.map((task) =>
        task.id === id ? updatedTask : task
      )
    );
  } catch (error) {
    console.error(error);
    toast.error("A feladat állapotának mentése nem sikerült.");
  }
};

  const toggleBill = async (id: number) => {
  if (!isAdmin) return;

  const currentBill = bills.find((bill) => bill.id === id);
  if (!currentBill) return;

  const paid = !currentBill.paid;

  const updatedBill = {
    ...currentBill,
    paid,
    paidBy: paid
      ? userName || currentBill.paidBy || currentBill.createdBy
      : "",
    paidAt: paid ? CURRENT_DATE : "",
  };

  try {
    const { icon, ...billData } = updatedBill;

    await set(ref(realtimeDb, `bills/${id}`), billData);

    setBills((current) =>
      current.map((bill) =>
        bill.id === id ? updatedBill : bill
      )
    );
  } catch (error) {
    console.error(error);
    toast.error("A számla állapotának mentése nem sikerült.");
  }
};

  const addTask = async (task: Task) => {
  if (!canModifyTasks) return;

  try {
    await set(ref(realtimeDb, `tasks/${task.id}`), task);
      } catch (error) {
    console.error(error);
    toast.error("A feladat mentése nem sikerült.");
  }
};

  const addBill = async (bill: Bill) => {
  if (!isAdmin) return;

  try {
    const { icon, ...billData } = bill;

    await set(ref(realtimeDb, `bills/${bill.id}`), billData);
    setBills((current) => [bill, ...current]);
  } catch (error) {
    console.error(error);
    toast.error("A számla mentése nem sikerült.");
  }
};
const addBudgetSource = async (amount: string, source: string) => {
  const normalizedAmount = amount.trim();
  const normalizedSource = source.trim();

  if (!normalizedAmount) {
    throw new Error("Az összeg megadása kötelező.");
  }

  if (amountValue(normalizedAmount) <= 0) {
    throw new Error("Az összegnek nagyobbnak kell lennie 0-nál.");
  }

  if (!normalizedSource) {
    throw new Error("A forrás kiválasztása kötelező.");
  }

  const sourceRef = push(ref(realtimeDb, "budgetSources"));

  const newSource: BudgetSource = {
    id: sourceRef.key || String(Date.now()),
    amount: normalizedAmount,
    source: normalizedSource,
    date: new Date().toISOString().slice(0, 10),
    createdAt: Date.now(),
  };

  await set(sourceRef, newSource);

  setBudgetSources((current) => [newSource, ...current]);
};
  const updateTask = async (task: Task) => {
  if (!canModifyTasks) return;

  try {
    const updatedTask = {
      ...task,
      createdBy: userName || task.createdBy || task.assignee,
    };

    await set(ref(realtimeDb, `tasks/${task.id}`), updatedTask);

    setTasks((current) =>
      current.map((item) =>
        item.id === task.id ? updatedTask : item
      )
    );

    setEditingTask(null);
    toast.success("A feladat adatai frissítve.");
  } catch (error) {
    console.error(error);
    toast.error("A feladat mentése nem sikerült.");
  }
};
     const updateBill = async (bill: Bill) => {
  if (!isAdmin) return;

  try {
    const updatedBill = {
      ...bill,
      createdBy: userName || bill.createdBy,
    };

    const { icon, ...billData } = updatedBill;

    await set(ref(realtimeDb, `bills/${bill.id}`), billData);

    setBills((current) =>
      current.map((item) =>
        item.id === bill.id ? updatedBill : item
      )
    );

    setEditingBill(null);
    toast.success("A számla adatai frissítve.");
  } catch (error) {
    console.error(error);
    toast.error("A számla mentése nem sikerült.");
  }
};
      const deleteTask = async (id: number) => {
  if (!isAdmin || !window.confirm("Biztosan törlöd ezt a feladatot?")) return;

  try {
    await remove(ref(realtimeDb, `tasks/${id}`));

    setTasks((current) =>
      current.filter((task) => task.id !== id)
    );

    toast.success("A feladat törölve.");
  } catch (error) {
    console.error(error);
    toast.error("A feladat törlése nem sikerült.");
  }
};
  const deleteBill = async (id: number) => {
  if (!isAdmin || !window.confirm("Biztosan törlöd ezt a számlát?")) return;

  try {
    alert("A törlendő számla ID-ja: " + id);
    console.log("ÖSSZES BILL ID:", bills.map((bill) => bill.id));

    const bill = bills.find((item) => item.id === id);

    if (!bill) {
      toast.error("A számla nem található.");
      return;
    }

    const deleteRef = ref(realtimeDb, `bills/${bill.id}`);

    console.log("FIREBASE PATH:", deleteRef.toString());

    await remove(deleteRef);

    console.log("REMOVE KÉSZ");

    setBills((current) =>
      current.filter((item) => item.id !== id)
    );

    toast.success("A számla törölve!");
  } catch (error) {
    console.error("TÖRLÉSI HIBA:", error);
    toast.error("A számla törlése nem sikerült.");
  }
};
  const filteredTasks = useMemo(
    () =>
      tasks.filter(
        (task) =>
          (filter === "Mind" || task.category === filter) &&
          task.title.toLowerCase().includes(search.toLowerCase())
      ),
    [tasks, filter, search]
  );

  const openTasks = tasks.filter((task) => !task.done).length;
  const paidBills = bills.filter((bill) => bill.paid).length;

  return (
    <div className="min-h-screen bg-[#050505] text-[#f3f0ff]">
      <div className="mx-auto flex min-h-screen max-w-[1440px]">
        <aside className="hidden w-[235px] shrink-0 flex-col border-r border-[#252525] bg-[#111111] px-5 py-7 lg:flex">
          <AppLogo />
          <p className="mb-3 mt-12 px-3 text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#9993a8]">
            Menü
          </p>
          <nav className="space-y-1.5">
            {navItems.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setView(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-[13px] px-3.5 py-3 text-left text-[13px] font-bold transition",
                  view === id
                    ? "bg-[#f0edff] text-[#6d5ef5]"
                    : "text-[#aaa6b8] hover:bg-[#1a1a1a] hover:text-[#ddd8ef]"
                )}
              >
                <Icon className="h-[18px] w-[18px]" />
                {label}
                {id === "bills" && bills.filter((bill) => !bill.paid).length > 0 && (
                  <span className="ml-auto rounded-full bg-[#fff0eb] px-1.5 py-0.5 text-[10px] text-[#df755d]">
                    {bills.filter((bill) => !bill.paid).length}
                  </span>
                )}
              </button>
            ))}
          </nav>
          <div className="mt-auto rounded-[18px] bg-[#fff7dd] p-4">
            <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-[10px] bg-[#ffe6a5] text-[#af8124]">
              <Sparkles className="h-4 w-4" />
            </div>
            <p className="text-[12px] font-extrabold text-[#6a5525]">Szép munka!</p>
            <p className="mt-1 text-[11px] leading-relaxed text-[#a08445]">
              Ezen a héten már {tasks.filter((task) => task.done).length} feladatot teljesítettetek.
            </p>
          </div>
          <button
            onClick={() => setView("settings")}
            className="mt-5 flex items-center gap-3 px-3 text-[13px] font-bold text-[#aaa6b8] hover:text-[#ddd8ef]"
          >
            <Settings2 className="h-[18px] w-[18px]" />
            Beállítások
          </button>
        </aside>

        <main className="min-w-0 flex-1 pb-24 lg:pb-8">
          <header className="flex items-center justify-between px-5 pb-4 pt-6 sm:px-8 sm:pt-8 lg:px-12">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileMenuOpen(true)} aria-label="Mobil menü megnyitása" className="rounded-xl p-2 text-[#aaa6b8] hover:bg-[#111111] lg:hidden">
                <Menu className="h-5 w-5" />
              </button>
              <div className="lg:hidden">
                <AppLogo small />
              </div>
            </div>
            <div className="flex items-center gap-2.5">
              <LoginDialog
  userName={userName}
  onLogin={(name) => {
    localStorage.setItem("kozosapp_user", name);
    setUserName(name);
  }}
  onLogout={() => {
    localStorage.removeItem("kozosapp_user");
    setUserName("");
  }}
/>
              <div className="hidden h-10 w-10 items-center justify-center rounded-full bg-[#f7a78f] text-xl sm:flex">
                {memberSymbolForName(userName || "Elod")}
              </div>
            </div>
          </header>
          <div className="px-5 sm:px-8 lg:px-12">
            {view === "home" && (
              <HomeView
                tasks={tasks}
                bills={bills}
                openTasks={openTasks}
                paidBills={paidBills}
                currentUser={userName}
                canEdit={canModifyTasks}
                canDelete={canDeleteTasks}
                canManage={isAdmin}
                onToggleTask={toggleTask}
                onToggleBill={toggleBill}
                onAddTask={addTask}
                onNavigate={setView}
                onEditTask={setEditingTask}
                onEditBill={setEditingBill}
                onDeleteTask={deleteTask}
                onDeleteBill={deleteBill}
              />
            )}
            {view === "tasks" && (
              <TasksView
                tasks={filteredTasks}
                filter={filter}
                setFilter={setFilter}
                search={search}
                setSearch={setSearch}
                currentUser={userName}
                canEdit={canModifyTasks}
                canDelete={canDeleteTasks}
                onToggleTask={toggleTask}
                onAddTask={addTask}
                onEditTask={setEditingTask}
                onDeleteTask={deleteTask}
              />
            )}
            {view === "bills" && (
              <BillsView
                bills={bills}
                currentUser={userName}
                canManage={isAdmin}
                onAddBill={addBill}
                onToggleBill={toggleBill}
                onEditBill={setEditingBill}
                onDeleteBill={deleteBill}
              />
            )}
            {view === "payments" && <PaymentsView bills={bills} />}
            {view === "budget" && (
  <BudgetView
    bills={bills}
    budgetSources={budgetSources}
    canManage={isAdmin}
    onAddSource={addBudgetSource}
  />
)}
            {view === "vehicles" && (
              <VehiclesView
                vehicles={vehicles}
                userName={userName}
                loading={vehiclesLoading}
                onCreate={addVehicle}
                onUpdate={updateVehicle}
                onDelete={deleteVehicle}
              />
            )}
            {view === "calendar" && (
              <CalendarView
                tasks={tasks}
                canEdit={canModifyTasks}
                canDelete={canDeleteTasks}
                onToggleTask={toggleTask}
                onEditTask={setEditingTask}
                onDeleteTask={deleteTask}
              />
            )}
            {view === "leaderboard" && <LeaderboardView />}
            {view === "settings" && <SettingsView currentUser={userName} isAdmin={isAdmin} members={members} onAddMember={addMember} onRemoveMember={removeMember} />}
          </div>
        </main>
      </div>
      <EditTaskDialog task={editingTask} onClose={() => setEditingTask(null)} onSave={updateTask} />
      <EditBillDialog bill={editingBill} onClose={() => setEditingBill(null)} onSave={updateBill} />
      {mobileMenuOpen && <nav className="fixed bottom-0 left-0 right-0 z-20 touch-pan-x overflow-x-auto scroll-smooth border-t border-[#252525] bg-[#111111]/95 py-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))] backdrop-blur lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex min-w-max items-center gap-1 px-2">
          {mobileNavItems.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => { setView(id); setMobileMenuOpen(false); }}
              className={cn(
                "flex min-w-[72px] shrink-0 flex-col items-center gap-1 rounded-[12px] px-2.5 py-1.5 text-[10px] font-bold transition-colors",
                view === id ? "bg-[#f0edff] text-[#6d5ef5]" : "text-[#aaa6b8] hover:bg-[#1a1a1a] hover:text-[#ddd8ef]"
              )}
            >
              <Icon className="h-[19px] w-[19px]" />
              {label}
            </button>
          ))}
        </div>
      </nav>}
    </div>
  );
}

function HomeView({
  tasks,
  bills,
  openTasks,
  paidBills,
  currentUser,
  canEdit,
  canDelete,
  canManage,
  onToggleTask,
  onToggleBill,
  onAddTask,
  onNavigate,
  onEditTask,
  onEditBill,
  onDeleteTask,
  onDeleteBill,
}: {
  tasks: Task[];
  bills: Bill[];
  openTasks: number;
  paidBills: number;
  currentUser: string;
  canEdit: boolean;
  canDelete: boolean;
  canManage: boolean;
  onToggleTask: (id: number) => void;
  onToggleBill: (id: number) => void;
  onAddTask: (task: Task) => void;
  onNavigate: (view: View) => void;
  onEditTask: (task: Task) => void;
  onEditBill: (bill: Bill) => void;
  onDeleteTask: (id: number) => void;
  onDeleteBill: (id: number) => void;
}) {
  const today = tasks.filter((task) => task.due === "Ma");
  const upcoming = tasks.filter((task) => task.due !== "Ma" && !task.done);
  const urgentToday = today.filter((task) => task.priority === "Magas" && !task.done).length;

  return (
    <div className="animate-in fade-in duration-500">
      <div className="relative mb-7 overflow-hidden rounded-[24px] bg-[#6d5ef5] p-5 text-white shadow-[0_12px_30px_rgba(109,94,245,0.18)] sm:p-7">
        <div className="absolute -right-8 -top-16 h-44 w-44 rounded-full border-[25px] border-[#8276fb] opacity-50" />
        <div className="absolute -bottom-24 right-28 h-48 w-48 rounded-full border-[28px] border-[#8679fa] opacity-35" />
        <Sparkles className="absolute right-8 top-7 h-5 w-5 text-[#ffe39a]" />
        <div className="relative max-w-[520px]">
          <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.15em] text-[#d5d0ff]">
            A mai közös terv
          </p>
          <h2 className="text-[25px] font-extrabold leading-tight tracking-[-0.04em] sm:text-[30px]">
            Együtt könnyebb
            <br />
            mindent elintézni.
          </h2>
          <p className="mt-3 max-w-[340px] text-[12px] leading-relaxed text-[#e4e1ff]">
            {openTasks} nyitott feladat és {bills.filter((bill) => !bill.paid).length} közelgő számla vár rátok.
          </p>
          <div className="mt-5 flex items-center gap-3">
            <div className="flex -space-x-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#6d5ef5] bg-[#f7a78f] text-base">
                🐺
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#6d5ef5] bg-[#83c9b9] text-base">
                🦅
              </div>
              <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-[#6d5ef5] bg-[#a9b7ee] text-base">
                🦉
              </div>
            </div>
            <span className="text-[11px] font-bold text-[#e4e1ff]">6 családtag aktív</span>
          </div>
        </div>
      </div>
      <div className="mb-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard
          label="Mai feladat"
          value={`${today.filter((task) => !task.done).length}`}
          sub={`${urgentToday} sürgős`}
          tone="purple"
          icon={ClipboardList}
        />
        <StatCard
          label="Teljesítve"
          value={`${tasks.filter((task) => task.done).length}`}
          sub="ezen a héten"
          tone="green"
          icon={CheckCircle2}
        />
        <StatCard
          label="Következő"
          value={`${upcoming.length}`}
          sub="nyitott közelgő feladat"
          tone="orange"
          icon={Clock3}
        />
        <StatCard
          label="Számlák"
          value={`${paidBills}/${bills.length}`}
          sub="kifizetve"
          tone="yellow"
          icon={CreditCard}
        />
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.3fr)_minmax(300px,0.7fr)]">
        <section>
          <SectionTitle
            icon={CalendarDays}
            title="Mai feladatok"
            count={today.length}
            action="Összes"
            onAction={() => onNavigate("tasks")}
          />
          <div className="space-y-2.5">
            {today.map((task) => (
              <TaskRow
                key={task.id}
                task={task}
                onToggle={onToggleTask}
                onEdit={onEditTask}
                onDelete={onDeleteTask}
                canEdit={canEdit}
                canDelete={canDelete}
              />
            ))}
          </div>
          <div className="mt-3">
            {canEdit && <NewTaskDialog onAdd={onAddTask} currentUser={currentUser} />}
          </div>
        </section>
        <section>
          <div className="mb-7">
  <SectionTitle
    icon={PiggyBank}
    title="Források"
    count={budgetSources.length}
  />

  <div className="space-y-2.5">
    {budgetSources.length === 0 ? (
      <div className="rounded-[16px] border border-[#252525] bg-[#111111] p-4 text-center text-xs text-[#aaa6b8]">
        Még nincs hozzáadott bevételi forrás.
      </div>
    ) : (
      budgetSources.map((source) => (
        <div
          key={source.id}
          className="flex items-center justify-between rounded-[16px] border border-[#252525] bg-[#111111] px-4 py-3"
        >
          <div>
            <p className="text-[12px] font-extrabold text-[#f3f0ff]">
              {source.source}
            </p>
            <p className="mt-0.5 text-[10px] text-[#aaa6b8]">
              {formatDate(source.date)}
            </p>
          </div>

          <p className="text-[13px] font-extrabold text-[#83c9b9]">
            +{formatLeiTotal(amountValue(source.amount))}
          </p>
        </div>
      ))
    )}
  </div>
</div>
          <SectionTitle
            icon={CreditCard}
            title="Közelgő számlák"
            action="Összes"
            onAction={() => onNavigate("bills")}
          />
          <div className="space-y-2.5">
            {bills.slice(0, 2).map((bill) => (
              <BillRow
                key={bill.id}
                bill={bill}
                onToggle={onToggleBill}
                onEdit={onEditBill}
                onDelete={onDeleteBill}
                canManage={canManage}
              />
            ))}
          </div>
          <button
            onClick={() => onNavigate("bills")}
            className="mt-3 flex w-full items-center justify-center gap-1 rounded-[14px] border border-dashed border-[#383838] py-2.5 text-[11px] font-bold text-[#aaa6b8] hover:border-[#aaa0e6] hover:text-[#6d5ef5]"
          >
            Összes számla <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </section>
      </div>
      <section className="mt-8">
        <SectionTitle
          icon={Repeat2}
          title="Következő napok"
          count={upcoming.length}
          action="Naptár megnyitása"
        />
        <div className="grid gap-2.5 md:grid-cols-2">
          {upcoming.slice(0, 4).map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggleTask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  tone: string;
  icon: LucideIcon;
}) {
  const styles: Record<string, string> = {
    purple: "bg-[#f0edff] text-[#6d5ef5]",
    green: "bg-[#e8f5ef] text-[#3c9c82]",
    orange: "bg-[#fff0e8] text-[#e68b68]",
    yellow: "bg-[#fff7dd] text-[#b98b29]",
  };
  return (
    <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-3.5">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-bold text-[#aaa6b8]">{label}</span>
        <div className={cn("flex h-7 w-7 items-center justify-center rounded-[9px]", styles[tone])}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-[23px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">{value}</p>
      <p className="mt-0.5 truncate text-[10px] font-semibold text-[#aaa6b8]">{sub}</p>
    </div>
  );
}

function TasksView({
  tasks,
  filter,
  setFilter,
  search,
  setSearch,
  currentUser,
  canEdit,
  canDelete,
  onToggleTask,
  onAddTask,
  onEditTask,
  onDeleteTask,
}: {
  tasks: Task[];
  filter: string;
  setFilter: (value: string) => void;
  search: string;
  setSearch: (value: string) => void;
  currentUser: string;
  canEdit: boolean;
  canDelete: boolean;
  onToggleTask: (id: number) => void;
  onAddTask: (task: Task) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
}) {
  const filters = ["Mind", "Otthon", "Család", "Bevásárlás", "Egészség"];
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Közös lista</p>
          <h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">Feladatok</h2>
        </div>
        {canEdit && <NewTaskDialog onAdd={onAddTask} currentUser={currentUser} />}
      </div>
      <div className="mb-5 flex flex-col gap-3">
        <div className="relative max-w-[400px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#aaa4b9]" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Keresés a feladatok között"
            className="h-11 rounded-[13px] border-[#303030] bg-[#111111] pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <Filter className="mr-1 h-4 w-4 shrink-0 text-[#9993ab]" />
          {filters.map((item) => (
            <button
              key={item}
              onClick={() => setFilter(item)}
              className={cn(
                "whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold transition",
                filter === item
                  ? "bg-[#6d5ef5] text-white"
                  : "bg-[#111111] text-[#aaa6b8] hover:bg-[#f0edff] hover:text-[#6d5ef5]"
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>
      <div className="space-y-2.5">
        {tasks.length ? (
          tasks.map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggleTask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#383838] bg-[#111111] px-5 py-12 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0edff] text-[#6d5ef5]">
              <Check className="h-6 w-6" />
            </div>
            <p className="font-extrabold text-[#eeeaf8]">Nincs ilyen feladat</p>
            <p className="mt-1 text-xs text-[#aaa6b8]">Próbálj másik kategóriát vagy keresést.</p>
          </div>
        )}
      </div>
    </div>
  );
}

function BillsView({
  bills,
  currentUser,
  canManage,
  onAddBill,
  onToggleBill,
  onEditBill,
  onDeleteBill,
}: {
  bills: Bill[];
  currentUser: string;
  canManage: boolean;
  onAddBill: (bill: Bill) => void;
  onToggleBill: (id: number) => void;
  onEditBill: (bill: Bill) => void;
  onDeleteBill: (id: number) => void;
}) {
  const outstanding = bills.filter((bill) => !bill.paid).length;
  const total = bills.reduce((sum, bill) => sum + amountValue(bill.amount), 0);
  const average = bills.length ? total / bills.length : 0;
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Kiadások egy helyen</p>
          <h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">Számlák</h2>
        </div>
        {canManage && <NewBillDialog onAdd={onAddBill} currentUser={currentUser} />}
      </div>
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] bg-[#6d5ef5] p-4 text-white">
          <p className="text-[11px] font-bold text-[#dcd8ff]">Ebben a hónapban</p>
          <p className="mt-2 text-[24px] font-extrabold">{formatLeiTotal(total)}</p>
          <p className="mt-1 text-[10px] text-[#dcd8ff]">{bills.length} tétel</p>
        </div>
        <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
          <p className="text-[11px] font-bold text-[#aaa6b8]">Fizetésre vár</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#e48768]">{outstanding}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#aaa6b8]">közelgő számla</p>
        </div>
        <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
          <p className="text-[11px] font-bold text-[#aaa6b8]">Átlagos kiadás</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#f3f0ff]">{formatLeiTotal(average)}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#aaa6b8]">a felvitt számlák alapján</p>
        </div>
      </div>
      <SectionTitle icon={CreditCard} title="Minden számla" count={bills.length} />
      <div className="space-y-2.5">
        {bills.length ? (
          bills.map((bill) => (
            <BillRow
              key={bill.id}
              bill={bill}
              onToggle={onToggleBill}
              onEdit={onEditBill}
              onDelete={onDeleteBill}
              canManage={canManage}
            />
          ))
        ) : (
          <div className="rounded-[22px] border border-dashed border-[#383838] bg-[#111111] px-5 py-12 text-center">
            <p className="font-extrabold text-[#eeeaf8]">Még nincs számla</p>
            <p className="mt-1 text-xs text-[#aaa6b8]">
              Az adminisztrátor hozzáadhatja az első számlát.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

function CalendarView({
  tasks,
  canEdit,
  canDelete,
  onToggleTask,
  onEditTask,
  onDeleteTask,
}: {
  tasks: Task[];
  canEdit: boolean;
  canDelete: boolean;
  onToggleTask: (id: number) => void;
  onEditTask: (task: Task) => void;
  onDeleteTask: (id: number) => void;
}) {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Heti ritmus</p>
        <h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">Naptár</h2>
      </div>
      <div className="mb-6 grid grid-cols-7 gap-1.5 sm:gap-2">
        {["H", "K", "Sze", "Cs", "P", "Szo", "V"].map((day, index) => (
          <div
            key={day}
            className={cn(
              "rounded-[15px] border p-2 text-center sm:p-3",
              index === 1
                ? "border-[#6d5ef5] bg-[#6d5ef5] text-white shadow-[0_7px_18px_rgba(109,94,245,0.18)]"
                : "border-[#252525] bg-[#111111] text-[#aaa6b8]"
            )}
          >
            <p className="text-[10px] font-bold">{day}</p>
            <p className="mt-2 text-[17px] font-extrabold">{[28, 29, 30, 1, 2, 3, 4][index]}</p>
            <div
              className={cn(
                "mx-auto mt-2 h-1.5 w-1.5 rounded-full",
                index === 1 ? "bg-[#ffe29a]" : "bg-[#c9c3de]"
              )}
            />
          </div>
        ))}
      </div>
      <SectionTitle
        icon={CalendarDays}
        title="Mai ütemezés"
        count={tasks.filter((task) => task.due === "Ma").length}
      />
      <div className="space-y-2.5">
        {tasks
          .filter((task) => task.due === "Ma")
          .map((task) => (
            <TaskRow
              key={task.id}
              task={task}
              onToggle={onToggleTask}
              onEdit={onEditTask}
              onDelete={onDeleteTask}
              canEdit={canEdit}
              canDelete={canDelete}
            />
          ))}
      </div>
    </div>
  );
}

function BudgetView({
  bills,
  budgetSources,
  canManage,
  onAddSource,
}: {
  bills: Bill[];
  budgetSources: BudgetSource[];
  canManage: boolean;
  onAddSource: (amount: string, source: string) => Promise<void>;
}) {
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false);
  const [sourceAmount, setSourceAmount] = useState("");
  const [sourceName, setSourceName] = useState("");
  
  const monthNames = [
    "január",
    "február",
    "március",
    "április",
    "május",
    "június",
    "július",
    "augusztus",
    "szeptember",
    "október",
    "november",
    "december",
  ];
  const currentMonthKey = CURRENT_DATE.slice(0, 7);
  const monthKeys = bills.length ? ["2026-09", "2026-08", "2026-07"] : [];
  const plannedBills = bills.filter(
    (bill) => !bill.paid || (bill.paidAt || "").startsWith(currentMonthKey)
  );
  const plannedTotal = plannedBills.reduce((sum, bill) => sum + amountValue(bill.amount), 0);
 const totalSources = budgetSources.reduce(
  (sum, source) => sum + amountValue(source.amount),
  0
);

const remaining = totalSources - plannedTotal;
  const remaining = income - plannedTotal;
  const monthlyHistory = monthKeys.map((key) => {
    const [year, month] = key.split("-");
    const total = bills
      .filter((bill) => bill.paid && (bill.paidAt || "").startsWith(key))
      .reduce((sum, bill) => sum + amountValue(bill.amount), 0);
    return { key, label: `${year}. ${monthNames[Number(month) - 1]}`, total };
  });
  const average =
    monthlyHistory.length
      ? monthlyHistory.reduce((sum, month) => sum + month.total, 0) / monthlyHistory.length
      : 0;
  const maxMonth = Math.max(...monthlyHistory.map((month) => month.total), 1);
  const submitSource = async () => {
  try {
    await onAddSource(sourceAmount, sourceName);

    setSourceAmount("");
    setSourceName("");
    setSourceDialogOpen(false);

    toast.success("A pénzforrás hozzáadva.");
  } catch (error) {
    toast.error(
      error instanceof Error
        ? error.message
        : "A pénzforrás hozzáadása nem sikerült."
    );
  }
};
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Tervezés három hónap alapján</p>
        <h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">Költségvetés</h2>
      </div>
      <div className="mb-6 rounded-[22px] border border-[#252525] bg-[#111111] p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-3">
  <label className="block text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#aaa6b8]">
    Használható keret
  </label>

  {canManage && (
    <Button
      type="button"
      variant="outline"
      onClick={() => setSourceDialogOpen(true)}
      className="h-8 rounded-[10px] border-[#383838] px-2.5 text-[10px] font-bold text-[#a69dff]"
    >
      <Plus className="mr-1 h-3 w-3" />
      Pénz hozzáadása
    </Button>
  )}
</div>

<div className="relative w-full sm:w-[260px]">
  <p className="h-12 rounded-[13px] border border-[#303030] bg-[#171717] px-3 flex items-center text-lg font-extrabold text-[#f3f0ff]">
    {formatLeiTotal(totalSources)}
  </p>
</div>
          </div>
          <p className="max-w-[320px] text-xs leading-relaxed text-[#aaa6b8]">
            A felvitt számlák tervezett költségként levonódnak, a kifizetett vásárlások pedig bekerülnek a háromhavi átlagba.
          </p>
        </div>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] bg-[#6d5ef5] p-4 text-white">
          <p className="text-[11px] font-bold text-[#dcd8ff]">Várható maradék</p>
          <p className="mt-2 text-[24px] font-extrabold">{formatLeiTotal(remaining)}</p>
          <p className="mt-1 text-[10px] text-[#dcd8ff]">bevétel mínusz számlák</p>
        </div>
        <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
          <p className="text-[11px] font-bold text-[#aaa6b8]">Felvitt számlák</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#f3f0ff]">
            {formatLeiTotal(plannedTotal)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#aaa6b8]">
            levonva ebben a hónapban
          </p>
        </div>
        <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
          <p className="text-[11px] font-bold text-[#aaa6b8]">3 havi átlag</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#f3f0ff]">{formatLeiTotal(average)}</p>
          <p className="mt-1 text-[10px] font-semibold text-[#aaa6b8]">
            általános kiadási alap
          </p>
        </div>
      </div>
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1fr)_minmax(300px,0.8fr)]">
        <section>
          <SectionTitle icon={CalendarDays} title="Előző 3 hónap" count={monthlyHistory.length} />
          <div className="space-y-3">
            {monthlyHistory.map((month) => (
              <div key={month.key} className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-extrabold text-[#f3f0ff]">{month.label}</p>
                  <p className="text-sm font-extrabold text-[#a69dff]">{formatLeiTotal(month.total)}</p>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-[#26232f]">
                  <div
                    className="h-full rounded-full bg-[#6d5ef5]"
                    style={{
                      width: `${Math.max((month.total / maxMonth) * 100, month.total ? 5 : 0)}%`,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
        <section>
          <SectionTitle icon={CreditCard} title="E havi levonások" count={plannedBills.length} />
          <div className="space-y-2.5">
            {plannedBills.map((bill) => (
              <div
                key={bill.id}
                className="flex items-center justify-between rounded-[16px] border border-[#252525] bg-[#111111] px-3.5 py-3"
              >
                <div>
                  <p className="text-[12px] font-extrabold text-[#f3f0ff]">{bill.name}</p>
                  <p className="mt-0.5 text-[10px] text-[#aaa6b8]">
                    {bill.type} · {bill.paid ? "Kifizetve" : `Esedékes ${bill.due}`}
                  </p>
                </div>
                <p className="text-[12px] font-extrabold text-[#f3f0ff]">{bill.amount}</p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
     <Dialog
      open={sourceDialogOpen}
      onOpenChange={setSourceDialogOpen}
    >
      <DialogContent className="w-[calc(100%-24px)] max-w-[430px] rounded-[26px] border-[#303030] bg-[#111111] p-6">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold text-[#f3f0ff]">
            Új pénz hozzáadása
          </DialogTitle>

          <DialogDescription className="text-[#aaa6b8]">
            Add meg az összeget és válaszd ki, kitől érkezett.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">
              Összeg
            </label>

            <div className="relative">
              <Input
                value={sourceAmount}
                onChange={(event) => setSourceAmount(event.target.value)}
                inputMode="decimal"
                placeholder="pl. 1000"
                className="h-11 rounded-[13px] border-[#303030] bg-[#171717] pr-14"
                autoFocus
              />

              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-[#aaa6b8]">
                lej
              </span>
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-bold text-[#c8c3d5]">
              Forrás
            </label>

            <select
              value={sourceName}
              onChange={(event) => setSourceName(event.target.value)}
              className="h-11 w-full rounded-[13px] border border-[#303030] bg-[#171717] px-3 text-sm text-[#f3f0ff] outline-none"
            >
              <option value="">Válassz személyt</option>

              {familyMembers.map((member) => (
                <option key={member.name} value={member.name}>
                  {member.name}
                </option>
              ))}
            </select>
          </div>

          <Button
            onClick={() => void submitSource()}
            className="h-11 w-full rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]"
          >
            <Plus className="mr-1.5 h-4 w-4" />
            Hozzáadás
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PaymentsView({ bills }: { bills: Bill[] }) {
  const paidBills = bills.filter((bill) => bill.paid);
  const grouped = paidBills.reduce<Record<string, { label: string; total: number; bills: Bill[] }>>(
    (result, bill) => {
      const date = bill.paidAt || CURRENT_DATE;
      const [year, month] = date.split("-");
      const monthNames = [
        "január",
        "február",
        "március",
        "április",
        "május",
        "június",
        "július",
        "augusztus",
        "szeptember",
        "október",
        "november",
        "december",
      ];
      const key = `${year}-${month}`;
      if (!result[key])
        result[key] = { label: `${year}. ${monthNames[Number(month) - 1]}`, total: 0, bills: [] };
      result[key].total += amountValue(bill.amount);
      result[key].bills.push(bill);
      return result;
    },
    {}
  );
  const months = Object.entries(grouped).sort(([first], [second]) => second.localeCompare(first));
  const total = paidBills.reduce((sum, bill) => sum + amountValue(bill.amount), 0);
  const currentMonthTotal = paidBills
    .filter((bill) => (bill.paidAt || CURRENT_DATE).startsWith(CURRENT_DATE.slice(0, 7)))
    .reduce((sum, bill) => sum + amountValue(bill.amount), 0);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Minden vásárlás egy helyen</p>
        <h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">Kifizetések</h2>
      </div>
      <div className="mb-7 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[18px] bg-[#6d5ef5] p-4 text-white">
          <p className="text-[11px] font-bold text-[#dcd8ff]">Összes kifizetés</p>
          <p className="mt-2 text-[24px] font-extrabold">{formatLeiTotal(total)}</p>
          <p className="mt-1 text-[10px] text-[#dcd8ff]">{paidBills.length} vásárlás</p>
        </div>
        <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
          <p className="text-[11px] font-bold text-[#aaa6b8]">Szeptemberben</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#f3f0ff]">
            {formatLeiTotal(currentMonthTotal)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#aaa6b8]">kifizetett vásárlás</p>
        </div>
        <div className="rounded-[18px] border border-[#252525] bg-[#111111] p-4">
          <p className="text-[11px] font-bold text-[#aaa6b8]">Havi átlag</p>
          <p className="mt-2 text-[24px] font-extrabold text-[#f3f0ff]">
            {formatLeiTotal(months.length ? total / months.length : 0)}
          </p>
          <p className="mt-1 text-[10px] font-semibold text-[#aaa6b8]">kifizetések alapján</p>
        </div>
      </div>
      <SectionTitle icon={ReceiptText} title="Havi bontás" count={months.length} />
      <div className="space-y-4">
        {months.map(([key, month]) => (
          <section key={key} className="rounded-[20px] border border-[#252525] bg-[#111111] p-4">
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h3 className="text-[15px] font-extrabold text-[#f3f0ff]">{month.label}</h3>
                <p className="mt-0.5 text-[11px] text-[#aaa6b8]">
                  {month.bills.length} kifizetett tétel
                </p>
              </div>
              <p className="text-[16px] font-extrabold text-[#a69dff]">
                {formatLeiTotal(month.total)}
              </p>
            </div>
            <div className="space-y-2">
              {month.bills.map((bill) => (
                <div
                  key={bill.id}
                  className="flex items-center justify-between rounded-[13px] bg-[#171717] px-3 py-2.5"
                >
                  <div>
                    <p className="text-[12px] font-bold text-[#f3f0ff]">{bill.name}</p>
                    <p className="mt-0.5 text-[10px] text-[#aaa6b8]">
                      {bill.type} · {bill.paidBy || bill.createdBy || "Nincs megadva"}
                    </p>
                  </div>
                  <p className="text-[12px] font-extrabold text-[#f3f0ff]">{bill.amount}</p>
                </div>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}

function LeaderboardView() {
  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-6">
        <p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Havi ranglista</p>
        <h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">
          Legszorgalmasabb
        </h2>
      </div>
      {monthlyCompletion.length > 0 ? (
        <div className="space-y-3">
          {monthlyCompletion.map((item, index) => (
            <div
              key={item.name}
              className="flex items-center justify-between rounded-[18px] border border-[#252525] bg-[#111111] p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-lg font-extrabold text-[#a69dff]">#{index + 1}</span>
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-full text-lg",
                    item.tone
                  )}
                >
                  {item.symbol}
                </div>
                <div>
                  <p className="text-sm font-extrabold text-[#f3f0ff]">{item.name}</p>
                  <p className="text-xs text-[#aaa6b8]">{item.completed} feladat teljesítve</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-[22px] border border-dashed border-[#383838] bg-[#111111] px-5 py-12 text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#f0edff] text-[#6d5ef5]">
            <Award className="h-6 w-6" />
          </div>
          <p className="font-extrabold text-[#eeeaf8]">Még nincs adat a ranglistához</p>
          <p className="mt-1 text-xs text-[#aaa6b8]">
            Végezzétek el a feladatokat a havi pontgyűjtéshez!
          </p>
        </div>
      )}
    </div>
  );
}

function SettingsView({ currentUser, isAdmin, members, onAddMember, onRemoveMember }: { currentUser: string; isAdmin: boolean; members: FamilyMember[]; onAddMember: (name: string) => Promise<void>; onRemoveMember: (name: string) => Promise<void> }) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);

  const addUser = async () => {
    setSaving(true);
    try {
      await onAddMember(newName);
      setNewName("");
      toast.success("Új felhasználó hozzáadva.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A felhasználó hozzáadása nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  const removeUser = async (member: FamilyMember) => {
    if (!window.confirm(`Biztosan eltávolítod ${member.name} felhasználót?`)) return;
    setSaving(true);
    try {
      await onRemoveMember(member.name);
      toast.success(`${member.name} eltávolítva.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "A felhasználó eltávolítása nem sikerült.");
    } finally {
      setSaving(false);
    }
  };

  return <div className="animate-in fade-in duration-500"><div className="mb-6"><p className="mb-1 text-[12px] font-bold text-[#aaa6b8]">Készülék és fiók</p><h2 className="text-[28px] font-extrabold tracking-[-0.05em] text-[#f3f0ff]">Beállítások</h2></div><div className="max-w-[680px] space-y-4"><div className="rounded-[22px] border border-[#252525] bg-[#111111] p-5 sm:p-6"><div className="mb-4 flex items-center gap-3 text-sm font-bold text-[#f3f0ff]"><Users className="h-5 w-5 text-[#6d5ef5]" /><span>Felhasználók</span><span className="rounded-full bg-[#26232f] px-2 py-0.5 text-[11px] text-[#aaa6b8]">{members.length}</span></div><div className="space-y-2">{members.map((member) => <div key={member.name} className="flex items-center gap-3 rounded-[15px] border border-[#252525] bg-[#171717] p-3"><div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl", member.tone)}>{member.symbol}</div><div className="min-w-0 flex-1"><p className="truncate text-sm font-extrabold text-[#f3f0ff]">{member.name}{member.name === currentUser && <span className="ml-2 rounded-full bg-[#f0edff] px-2 py-1 text-[9px] font-extrabold text-[#6d5ef5]">TE</span>}</p><p className="mt-0.5 text-xs text-[#aaa6b8]">{member.role === "admin" ? "Adminisztrátor" : "Sima felhasználó"} · Aktív</p></div>{isAdmin && member.name !== "Elod" && <button disabled={saving} onClick={() => void removeUser(member)} aria-label={`${member.name} eltávolítása`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[9px] border border-[#583333] text-[#e48868] hover:border-[#e05d5d]"><Trash2 className="h-3.5 w-3.5" /></button>}</div>)}</div></div>{isAdmin && <div className="rounded-[22px] border border-[#252525] bg-[#111111] p-5 sm:p-6"><div className="mb-3 flex items-center gap-3 text-sm font-bold text-[#f3f0ff]"><Plus className="h-5 w-5 text-[#6d5ef5]" /><span>Új felhasználó hozzáadása</span></div><p className="mb-4 text-xs text-[#aaa6b8]">Elod adminisztrátorként új sima felhasználót vehet fel.</p><div className="flex flex-col gap-2 sm:flex-row"><Input value={newName} onChange={(event) => setNewName(event.target.value)} onKeyDown={(event) => event.key === "Enter" && void addUser()} placeholder="Felhasználó neve" className="h-11 rounded-[13px] border-[#303030] bg-[#171717]" /><Button disabled={saving || !newName.trim()} onClick={() => void addUser()} className="h-11 rounded-[13px] bg-[#6d5ef5] font-bold hover:bg-[#5d4fe1]"><Plus className="mr-1.5 h-4 w-4" />Hozzáadás</Button></div></div>}</div></div>;
}
