export interface WooOrder {
    id: number;
    status: 'pending' | 'processing' | 'on-hold' | 'completed' | 'cancelled' | 'refunded' | 'failed' | string;
    currency: string;
    total: string;
    date_created: string;
    billing: {
        first_name: string;
        last_name: string;
        phone: string;
        city: string;
        address_1: string;
    };
    line_items: Array<{
        id: number;
        name: string;
        quantity: number;
        total: string;
    }>;
}

export interface WooProduct {
    id: number;
    name: string;
    type: string;
    status: string;
    price: string;
    regular_price: string;
    sale_price: string;
    stock_quantity: number | null;
    stock_status: string;
    manage_stock: boolean;
    images: Array<{
        id: number;
        src: string;
        alt: string;
    }>;
}

export interface WooVariation {
    id: number;
    price: string;
    regular_price: string;
    sale_price: string;
    stock_quantity: number | null;
    stock_status: string;
    manage_stock: boolean;
    attributes: Array<{
        name: string;
        option: string;
    }>;
}