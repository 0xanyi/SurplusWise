"use client";
 "use client";

 import { useState, useEffect } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
 import { TransactionForm } from "./transaction-form";
 import { useToast } from "@/hooks/use-toast";
 import { formatCurrency, cn } from "@/lib/utils";
 import { ArrowUpRight, ArrowDownRight, Pencil, Trash2, Search, SlidersHorizontal, Receipt } from "lucide-react";

 interface Transaction {
   id: string;
   amount: number;
   date: string;
   type: 'expense' | 'giving';
   category: string;
   notes: string | null;
   created_at: string;
 }

 interface Category {
   id: string;
   name: string;
   type: 'expense' | 'giving';
 }

 export function TransactionList() {
   const { toast } = useToast();
   const [transactions, setTransactions] = useState<Transaction[]>([]);
   const [categories, setCategories] = useState<Category[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
   const [isFormOpen, setIsFormOpen] = useState(false);

   const [searchQuery, setSearchQuery] = useState('');
   const [typeFilter, setTypeFilter] = useState<'all' | 'expense' | 'giving'>('all');
   const [categoryFilter, setCategoryFilter] = useState<string>('all');

   useEffect(() => {
     fetchTransactions();
     fetchCategories();
   }, [typeFilter, categoryFilter, searchQuery]);

   const fetchTransactions = async () => {
     try {
       setLoading(true);
       const params = new URLSearchParams();
       if (typeFilter !== 'all') params.append('type', typeFilter);
       if (categoryFilter !== 'all') params.append('category', categoryFilter);
       if (searchQuery) params.append('search', searchQuery);

       const response = await fetch(`/api/transactions?${params}`);
       if (response.ok) {
         const data = await response.json();
         setTransactions(data.transactions || []);
       }
     } catch (error) {
       console.error('Error fetching transactions:', error);
       toast({
         title: "Error",
         description: "Failed to fetch transactions",
         variant: "destructive",
       });
     } finally {
       setLoading(false);
     }
   };

   const fetchCategories = async () => {
     try {
       const response = await fetch('/api/categories');
       if (response.ok) {
         const data = await response.json();
         setCategories(data.categories || []);
       }
     } catch (error) {
       console.error('Error fetching categories:', error);
     }
   };

   const handleEdit = (transaction: Transaction) => {
     setSelectedTransaction(transaction);
     setIsFormOpen(true);
   };

   const handleDelete = async (id: string) => {
     if (!confirm('Are you sure you want to delete this transaction?')) return;

     try {
       const response = await fetch(`/api/transactions/${id}`, { method: 'DELETE' });
       if (response.ok) {
         toast({ title: "Success", description: "Transaction deleted successfully" });
         fetchTransactions();
       } else {
         throw new Error('Failed to delete transaction');
       }
     } catch (error) {
       toast({ title: "Error", description: "Failed to delete transaction", variant: "destructive" });
     }
   };

   const handleFormClose = () => {
     setIsFormOpen(false);
     setSelectedTransaction(null);
   };

   const filteredCategories = categories.filter(cat => typeFilter === 'all' || cat.type === typeFilter);

   return (
     <>
       <Card className="border shadow-sm">
         <CardHeader className="pb-4">
           <CardTitle className="text-lg font-semibold">All Transactions</CardTitle>
         </CardHeader>
         <CardContent>
           {/* Filters */}
           <div className="flex flex-col sm:flex-row gap-3 mb-6">
             <div className="flex-1 relative">
               <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
               <Input
                 placeholder="Search transactions..."
                 value={searchQuery}
                 onChange={(e) => setSearchQuery(e.target.value)}
                 className="pl-10 h-10 bg-muted/50 border-0 focus-visible:ring-1"
               />
             </div>

             <Select value={typeFilter} onValueChange={(value: any) => {
               setTypeFilter(value);
               setCategoryFilter('all');
             }}>
               <SelectTrigger className="w-full sm:w-[140px] h-10 bg-muted/50 border-0">
                 <SlidersHorizontal className="size-4 mr-2 text-muted-foreground" />
                 <SelectValue />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Types</SelectItem>
                 <SelectItem value="expense">Expenses</SelectItem>
                 <SelectItem value="giving">Givings</SelectItem>
               </SelectContent>
             </Select>

             <Select value={categoryFilter} onValueChange={setCategoryFilter}>
               <SelectTrigger className="w-full sm:w-[160px] h-10 bg-muted/50 border-0">
                 <SelectValue placeholder="All Categories" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">All Categories</SelectItem>
                 {filteredCategories.map((cat) => (
                   <SelectItem key={cat.id} value={cat.name}>{cat.name}</SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>

           {/* Transaction List */}
           {loading ? (
             <div className="space-y-2">
               {[1, 2, 3, 4, 5].map((i) => (
                 <div key={i} className="flex items-center gap-4 p-4 rounded-xl bg-muted/30">
                   <Skeleton className="size-10 rounded-xl" />
                   <div className="flex-1 space-y-2">
                     <Skeleton className="h-4 w-32" />
                     <Skeleton className="h-3 w-20" />
                   </div>
                   <Skeleton className="h-5 w-16" />
                 </div>
               ))}
             </div>
           ) : transactions.length === 0 ? (
             <div className="text-center py-16">
               <div className="size-14 mx-auto mb-4 rounded-full bg-muted flex items-center justify-center">
                 <Receipt className="size-7 text-muted-foreground" />
               </div>
               <p className="font-medium">No transactions found</p>
               <p className="text-sm text-muted-foreground mt-1">
                 {searchQuery || typeFilter !== 'all' || categoryFilter !== 'all'
                   ? 'Try adjusting your filters'
                   : 'Start by adding your first transaction'}
               </p>
             </div>
           ) : (
             <div className="space-y-2">
               {transactions.map((transaction) => (
                 <div
                   key={transaction.id}
                   className="group flex items-center justify-between p-4 rounded-xl hover:bg-muted/50 transition-colors duration-150"
                 >
                   <div className="flex items-center gap-4 flex-1 min-w-0">
                     <div className={cn(
                       "size-10 rounded-xl flex items-center justify-center shrink-0",
                       transaction.type === 'expense'
                         ? "bg-rose-100 dark:bg-rose-900/40"
                         : "bg-emerald-100 dark:bg-emerald-900/40"
                     )}>
                       {transaction.type === 'expense' ? (
                         <ArrowDownRight className="size-5 text-rose-600 dark:text-rose-400" />
                       ) : (
                         <ArrowUpRight className="size-5 text-emerald-600 dark:text-emerald-400" />
                       )}
                     </div>

                     <div className="flex-1 min-w-0">
                       <div className="flex items-center gap-2">
                         <p className="font-medium text-sm">{transaction.category}</p>
                         <span className={cn(
                           "text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wide",
                           transaction.type === 'expense'
                             ? "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300"
                             : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300"
                         )}>
                           {transaction.type}
                         </span>
                       </div>
                       {transaction.notes && (
                         <p className="text-xs text-muted-foreground truncate mt-0.5">{transaction.notes}</p>
                       )}
                       <p className="text-xs text-muted-foreground mt-1">
                         {new Date(transaction.date).toLocaleDateString('en-US', {
                           year: 'numeric', month: 'short', day: 'numeric'
                         })}
                       </p>
                     </div>

                     <div className="text-right shrink-0">
                       <p className={cn(
                         "text-base font-semibold",
                         transaction.type === 'expense' ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"
                       )}>
                         {transaction.type === 'expense' ? '-' : '+'}
                         {formatCurrency(transaction.amount)}
                       </p>
                     </div>
                   </div>

                   <div className="flex items-center gap-1 ml-4 opacity-0 group-hover:opacity-100 transition-opacity">
                     <Button
                       variant="ghost"
                       size="icon"
                       className="size-8 rounded-lg hover:bg-muted"
                       onClick={() => handleEdit(transaction)}
                     >
                       <Pencil className="size-4 text-muted-foreground" />
                     </Button>
                     <Button
                       variant="ghost"
                       size="icon"
                       className="size-8 rounded-lg hover:bg-rose-100 dark:hover:bg-rose-900/30"
                       onClick={() => handleDelete(transaction.id)}
                     >
                       <Trash2 className="size-4 text-rose-600 dark:text-rose-400" />
                     </Button>
                   </div>
                 </div>
               ))}
             </div>
           )}
         </CardContent>
       </Card>

       <TransactionForm
         open={isFormOpen}
         onOpenChange={handleFormClose}
         transaction={selectedTransaction}
         onSuccess={fetchTransactions}
       />
     </>
   );
 }