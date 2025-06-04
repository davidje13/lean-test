declare const brand: unique symbol;

export type Ptr<T> = symbol & {
	readonly [brand]: T; // exists for type checking
};
