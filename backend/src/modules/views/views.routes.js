// Empty routes file - views can be implemented as needed
export default async function viewRoutes(fastify, options) {
  // Views are optional for MVP - can be added later
  fastify.get('/', async (request, reply) => {
    return { message: 'Views module placeholder' };
  });
}
